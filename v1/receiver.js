/*
 * Copyright (C) 2013-2014, The OpenFlint Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

"use strict"

/**
 * Websocket connection's state code
 * @type {number}
 */
var CONNECTING = 0; // The connection is not yet open.
var OPEN = 1;       // The connection is open and ready to communicate.
var CLOSING = 2;    // The connection is in the process of closing.
var CLOSED = 3;     // The connection is closed or couldn't be opened.

var ReceiverManager = function (appid) {
    /*************************************************
     * member variable definition and initialization *
     *************************************************/
    var self = this;

    var _flingIpc = null;
    var _senders = {};
    var _additionaldata = null;

    var _channels = {};

    var _appid = appid;
    var _wsServer = "ws://127.0.0.1:9431/receiver/" + appid;
    var _wsFlingdIp = null;

    /******************************************
     * methods definition *
     ******************************************/

    /**
     * open IPC and start ReceiverManager
     */
    self.open = function () {
        if (!_appid) {
            console.error("appid must be set before openning websocket!!!");
            return;
        }

        if (self._isStarted()) {
            console.warn("flingIPC's state is ", _flingIpc.readyState, ", cannot reopen");
            return;
        }

        // open MessageChannel before opening IPC
        for (var channel in _channels) {
            _channels[channel].open();
        }

        _flingIpc = new WebSocket(_wsServer);
        _flingIpc.onopen = function (event) {
            console.info("flingIPC onopen!!!");
            self.send({"type": "register"});
            ("onopen" in self) && (self.onopen(event));
        };
        _flingIpc.onclose = function (event) {
            console.info("flingIPC onclose!!!");
            ("onclosed" in self) && (self.onclose(event));
            _flingIpc = null;
        };
        _flingIpc.onerror = function (event) {
            console.error("flingIPC onerror: ", event);
            event.message = "Underlying websocket is not open";
            event.socketReadyState = event.target.readyState;
            ("onerror" in self) && (self.onerror(event));
            _flingIpc = null;
        };
        _flingIpc.onmessage = function (event) {
            console.info("flingIPC onmessage: [", event, "]");
            if (event.data) {
                var data = JSON.parse(event.data);
                self._onmessage(data);
            }
        };
    };

    /**
     * close ReceiverManager and close all channels if present
     */
    self.close = function () {
        self.send({"type": "unregister"});
        for (var channel in _channels) {
            _channels[channel].close();
        }
        _flingIpc.close();
    };

    /**
     * set additional data
     * @param additionaldata
     */
    self.setAdditionalData = function (additionaldata) {
        _additionaldata = additionaldata;
        console.info("set additionaldata to: ", _additionaldata);
        self.send({"type": "additionaldata", "additionaldata": _additionaldata});
    };

    /**
     * check the daemon is started or not
     * @returns {*|boolean}
     * @private
     */
    self._isStarted = function () {
        return _flingIpc && (_flingIpc.readyState == CONNECTING || _flingIpc.readyState == OPEN);
    };

    /**
     * handle IPC message event.
     * handler system message only and forward custom message.
     * @param data
     * @private
     */
    self._onmessage = function (data) {
        if (data) {
            console.info("ReceiverManager received: ", data);
            switch (data.type) {
                case "startheartbeat":
                    console.info("receiver ready to start heartbeat!!!");
                    break;
                case "registerok":
                    console.info("receiver register done!!!");
                    _wsFlingdIp = data["service_info"]["ip"][0];
                    // var uuid = data["service_info"]["uuid"];
                    // var deviceName = data["service_info"]["device_name"];

                    if (_additionaldata) {
                        self.send({"type": "additionaldata", "additionaldata": _additionaldata});
                    } else {
                        var additionalData = {}
                        var size = self.getChannelsCount();
                        if (size == 1) {
                            for (var channel in _channels) {
                                additionalData["channelBaseUrl"] = "ws://" + _wsFlingdIp + ":9439/channels/" + channel;
                            }
                        } else if (size > 1) {
                            for (var channel in _channels) {
                                additionalData[channel] = "ws://" + _wsFlingdIp + ":9439/channels/" + channel;
                            }
                        }
                        if (Object.keys(additionalData).length > 0) {
                            self.send({"type": "additionaldata", "additionaldata": additionalData});
                        }
                    }
                    break;
                case "heartbeat":
                    if (data.heartbeat == "ping") {
                        self.send({"type": "heartbeat", "heartbeat": "pong"});
                    } else if (data.heartbeat == "pong") {
                        self.send({"type": "heartbeat", "heartbeat": "ping"});
                    } else {
                        console.error("unknow heartbeat message!!!");
                    }
                    break;
                case "senderconnected":
                    _senders[data.token] = data.token;
                    ("onsenderconnected" in self) && (self.onsenderconnected(data.token));
                    break;
                case "senderdisconnected":
                    delete _senders[data.token];
                    ("onsenderdisconnected" in self) && (self.onsenderdisconnected(data.token));
                    break;
                default:
                    console.warn("unknow IPC message: ", data);
                    break;
            }
        }
    };

    /**
     * send data to IPC
     * @param data
     */
    self.send = function (data) {
        console.info("ReceiverManager send: [", data, "] to ", _appid);
        data["appid"] = _appid;
        data = JSON.stringify(data);
        if (_flingIpc && _flingIpc.readyState == OPEN) {
            _flingIpc.send(data);
        } else if (_flingIpc && _flingIpc.readyState == CONNECTING) {
            console.warn("IPC not ready, send delay");
            var selfSend = this;
            setTimeout(function () {
                selfSend.send(data);
            }, 50);
        } else {
            console.error("IPC not ready, send failed!");
        }
    };

    /**
     * Events callback
     * @param {String} Event types: message|open|close|senderconnected|senderdisconnected|error
     * @param {function} callback function
     */
    self.on = function (type, func) {
        self["on" + type] = func;
    };

    /**
     * create a new MessageChannel. Must be called before ReceiverManager.open()
     * @param channelId
     * @returns MessageChannel
     */
    self.createMessageChannel = function (channelId) {
        if (self._isStarted()) {
            console.error("ReceiverManager is started, cannot create new MessageChannel!");
            return;
        }

        if (!channelId) {
            channelId = "main_message_channel";
        }

        if (_channels[channelId]) {
            console.error("duplicated MessageChannel id: ", channelId);
        } else {
            _channels[channelId] = new MessageChannel(self, channelId);
        }
        return _channels[channelId];
    };

    self.getChannels = function () {
        return _channels;
    };

    self.getChannelsCount = function () {
        return Object.keys(_channels).length;
    };

    /**
     * get all senders
     * @returns {{}}
     */
    self.getSenders = function () {
        return _senders;
    };

    /**
     * get the count of all senders
     * @returns {Number}
     */
    self.getSenderCount = function () {
        return Object.keys(_senders).length;
    };

    /**
     * handle broken MessageChannel
     * @param channelId
     */
    self.onMessageChannelError = function (channelId) {
        console.error("MessageChannel [", channelId, "] is broken!!!");
        delete _channels[channelId];
    };
};

/*
 * Message Channel with Sender Application
 **/
var MessageChannel = function (daemon, channelId) {
    var self = this;
    var tag = "#####";
    var _daemon = daemon;

    var _channelId = channelId;
    var _channel = null;

    self.getChannelId = function () {
        return _channelId;
    };

    /**
     * open this MessageChannel
     */
    self.open = function () {
        if (_channel && (_channel.readyState == CONNECTING || _channel.readyState == OPEN)) {
            console.warn(tag, "MessageChannel [", _channelId, "]", " state is ", _channel.readyState, ", cannot reopen");
            return;
        }

        // additional data 中tag为channelBaseUrl
        _channel = new WebSocket("ws://127.0.0.1:9439/channels/" + _channelId);
        _channel.onopen = function (event) {
            console.info(tag, "MessageChannel [", _channelId, "] open");
            ("onopen" in self) && (self.onopen(event));
        };
        _channel.onclose = function (event) {
            console.info(tag, "MessageChannel [", _channelId, "] close");
            ("onclose" in self) && (self.onclose(event));
        };

        _channel.onmessage = function (event) {
            console.info(tag, "MessageChannel [", _channelId, "] received: ", event.data);
            self._onmessage(JSON.parse(event.data));
        };
        _channel.onerror = function (event) {
            console.info(tag, "MessageChannel [", _channelId, "] error");
            ("onerror" in self) && (self.onerror(event));
            if (_daemon.onMessageChannelError) {
                _daemon.onMessageChannelError(_channelId);
            }
        };
    };

    /**
     * handler message from MessageChannel
     * @param message
     * @private
     */
    self._onmessage = function (message) {
        if (message) {
            switch (message.type) {
                case "senderConnected":
                    console.info(tag, "MessageChannel [", _channelId, "] received senderConnected");
                    console.info(tag, message.senderId, " connected!!!");
                    ("onsenderConnected" in self) && (self.onsenderConnected(message.senderId));
                    break;
                case "senderDisonnected":
                    console.info(tag, "MessageChannel [", _channelId, "] received senderDisonnected");
                    console.info(tag, message.senderId, " left!!!");
                    ("onsenderDisonnected" in self) && (self.onsenderDisonnected(message.senderId));
                    break;
                case "message":
                    ("onmessage" in self) && self.onmessage(message.senderId, message.data);
                    break;
                default:
                    break;
            }
        }
    };

    /**
     * close channel
     */
    self.close = function () {
        if (_channel) {
            _channel.close();
        }
    };

    /**
     * send message
     * @param data
     * @param senderId: null-value or '*:*' means it's a broadcast
     */
    self.send = function (data, senderId) {
        var message = {};
        if (!senderId) {
            message["senderId"] = "*:*";
        } else {
            message["senderId"] = senderId;
        }
        message["data"] = data;
        var _message = JSON.stringify(message);
        console.info(tag, "MessageChannel [", _channelId, "] send: ", _message);
        if (_channel && _channel.readyState == OPEN) {
            _channel.send(_message);
        } else if (_channel && _channel.readyState == CONNECTING) {
            console.error(tag, "MessageChannel [", _channelId, "] send delay");
            var selfSend = this;
            setTimeout(function () {
                selfSend.send(_message);
            }, 50);
        } else {
            console.error(tag, "MessageChannel [", _channelId, "] send message failed. It not ready");
            var event = {};
            event.message = "Underlying MessageChannel is not open";
            event.socketReadyState = CLOSED;
            _channel._onerror(event);
        }
    };

    /**
     * Events callback
     * @param {String} Event types: message|open|close|senderConnected|senderDisconnected|error
     * @param {function} callback function
     */
    self.on = function (type, func) {
        self["on" + type] = func;
    };
};
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

var ReceiverManagerWrapper = function (appid) {
    var self = this;
    var _tag = "ReceiverManagerWrapper *** ->";

    var _receiverManager = new ReceiverManager(appid);
    var _mainChannel = _receiverManager.createMessageChannel("main_message_channel");
    var _messageBusList = {};
    var _senders = {};

    self.open = function () {
        _mainChannel.on("senderConnected", function (senderId) {
            _senders[senderId] = senderId;
            for (var bus in _messageBusList) {
                _messageBusList[bus]._onsenderConnected(senderId);
            }
        });

        _mainChannel.on("senderDisconnected", function (senderId) {
            delete _senders[senderId];
            for (var bus in _messageBusList) {
                _messageBusList[bus]._onsenderDisconnected(senderId);
            }
        });

        _mainChannel.on("message", function (senderId, message) {
            var data = JSON.parse(message);
            var ns = data.namespace;
            if (ns && _messageBusList[ns]) {
                _messageBusList[ns]._onmessage(senderId, data.payload);
            }
        });

        _receiverManager.open();
    };

    self.createMessageBus = function (namespace) {
        var messageBus = null;
        if (namespace) {
            if (_messageBusList[namespace]) {
                messageBus = _messageBusList[namespace];
            } else {
                messageBus = new MessageBus(_mainChannel, namespace);
                _messageBusList[namespace] = messageBus;
            }
        } else {
            console.error(_tag, " createMessageBus namespace is null");
        }
        return messageBus;
    };

    self.getMessageBusList = function () {
        return _messageBusList;
    };

    self.getSenderList = function () {
        return _senders;
    };

    self.close = function () {
        _receiverManager.close();
    };
};

var MessageBus = function (channel, namespace) {
    var self = this;
    var _tag = "MessageBus $$$ ->";
    var _channel = channel;
    var _namespace = namespace;

    self._onsenderConnected = function (senderId) {
        console.log(_tag, "received sender connected: ", senderId);
        ("onsenderConnected" in self) && (self.onsenderConnected(senderId));
    };

    self._onsenderDisconnected = function (senderId) {
        console.log(_tag, "received sender disconnected: ", senderId);
        ("onsenderDisconnected" in self) && (self.onsenderDisconnected(senderId));
    };

    self._onmessage = function (senderId, payload) {
        console.log(_tag, "received sender message: [", senderId, "] to ", payload);
        ("onmessage" in self) && (self.onmessage(senderId, payload));
    };

    self.send = function (payload, senderId) {
        var data = {};
        data["namespace"] = _namespace;
        data["payload"] = payload;
        if (_channel) {
            _channel.send(JSON.stringify(data), senderId);
        }
    };

    self.on = function (type, func) {
        self["on" + type] = func;
    };
}
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

    var _receiverManager = new ReceiverManager(appid);

    var _mainChannel = null;
    var _messageBusList = {};

    self.open = function () {
        _mainChannel = _receiverManager.createMessageChannel();
        for (var bus in _messageBusList) {
            _messageBusList[bus].setChannel(_mainChannel);
        }

        _mainChannel.on("senderConnected", function (senderId) {
            for (var bus in _messageBusList) {
                _messageBusList[bus]._onsenderConnected(senderId);
            }
        });

        _mainChannel.on("senderDisonnected", function (senderId) {
            for (var bus in _messageBusList) {
                _messageBusList[bus]._onsenderDisonnected(senderId);
            }
        });

        _mainChannel.on("message", function (senderId, message) {
            var data = JSON.parse(message);
            var ns = data.namespace;
            if (ns && _messageBusList[ns]) {
                _messageBusList[ns].onmessage(senderId, data.payload);
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
        }
        return messageBus;
    };

    self.getMessageBusList = function () {
        return _messageBusList;
    };

    self.close = function () {
        _receiverManager.close();
    };

    self.setAdditionalData = function (additionaldata) {
        _receiverManager.setAdditionalData(additionaldata);
    };
};

var MessageBus = function (channel, namespace) {
    var self = this;
    var tag = "@@@";
    var _channel = channel;
    var _namespace = namespace;
    var _senders = {}

    self._onsenderConnected = function (senderId) {
        console.log(tag, "received sender connected: ", senderId);
        _senders[senderId] = senderId;
        ("onsenderConnected" in self) && (self.onsenderConnected(senderId));
    };

    self._onsenderDisonnected = function (senderId) {
        console.log(tag, "received sender disconnected: ", senderId);
        delete _senders[senderId];
        ("onsenderDisonnected" in self) && (self.onsenderDisonnected(senderId));
    };

    self.onmessage = function (senderId, payload) {
        console.log(tag, "received sender message: [", senderId, "] to ", payload);
    };

    self.send = function (payload, senderId) {
        var data = {};
        data["namespace"] = _namespace;
        data["payload"] = payload;
        if (_channel) {
            _channel.send(JSON.stringify(data), senderId);
        }
    };

    self.setChannel = function(channel) {
        _channel = channel;
    };

    self.getSenderList = function () {
        return _senders;
    };

    self.getNamespace = function() {
        return _namespace;
    };

    self.on = function (type, func) {
        self["on" + type] = func;
    };
}
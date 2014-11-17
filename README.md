flint-receiver-sdk
==================
Include the two JavaScript in your web app:
```html
<script src="//openflint.github.io/flint-receiver-sdk/v1/receiver.js"></script>
<script src="//openflint.github.io/flint-receiver-sdk/v1/receiver_wrapper.js"></script>
```
* The **receiver.js** library provides a ReceiverManager based on WebSocket to register your receiver app on Fling Daemon and a MessageChannel also based on WebSocket to communicate with senders without any data wrapper. 
* The **receiver_wrapper.js** library provides ReceiverManagerWrapper and MessageBus to make a namespace data wrapper atop the MessageChannel interface; It is used to work with Android/iOS Flint SDK.

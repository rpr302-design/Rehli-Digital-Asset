// Firebase SDK Scripts को इम्पोर्ट करें
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// आपके ऐप का Firebase कॉन्फ़िगरेशन (बिल्कुल सेम होना चाहिए)
firebase.initializeApp({
    apiKey: "AIzaSyAuqo9MoZ9lr4STXztO36n0ASqHOytdAeI",
    authDomain: "rehli-digital-asset.firebaseapp.com",
    projectId: "rehli-digital-asset",
    storageBucket: "rehli-digital-asset.firebasestorage.app",
    messagingSenderId: "779415089179",
    appId: "1:779415089179:web:4f6654088af999ed7ac8be"
});

// मेसेजिंग ऑब्जेक्ट चालू करें
const messaging = firebase.messaging();

// बैकग्राउंड नोटिफिकेशन को हैंडल करने के लिए (ज़रूरी है)
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] बैकग्राउंड में नोटिफिकेशन मिला: ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.ico' // यहाँ आप अपने ऐप के लोगो का पाथ दे सकते हैं
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

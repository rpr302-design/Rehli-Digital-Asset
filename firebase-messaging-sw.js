// यह सर्विस वर्कर फाइल है
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// अपना Firebase Config यहाँ डालें (वही जो आपने प्रोफाइल पेज में डाला है)
firebase.initializeApp({
    apiKey: "AIzaSyAuqo9MoZ9lr4STXztO36n0ASqHOytdAeI",
    authDomain: "rehli-digital-asset.firebaseapp.com",
    projectId: "rehli-digital-asset",
    storageBucket: "rehli-digital-asset.firebasestorage.app",
    messagingSenderId: "779415089179",
    appId: "1:779415089179:web:4f6654088af999ed7ac8be"
});

const messaging = firebase.messaging();

// जब नोटिफिकेशन बैकग्राउंड में आए तो उसे कैसे दिखाएँ
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/firebase-logo.png' // आप अपना लोगो यहाँ लगा सकते हैं
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

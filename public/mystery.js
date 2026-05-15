import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAuqo9MoZ9lr4STXztO36n0ASqHOytdAeI",
    authDomain: "rehli-digital-asset.firebaseapp.com",
    projectId: "rehli-digital-asset",
    storageBucket: "rehli-digital-asset.firebasestorage.app",
    messagingSenderId: "779415089179",
    appId: "1:779415089179:web:4f6654088af999ed7ac8be"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const mobile = localStorage.getItem('userMobile');
if (!mobile) window.location.href = "index.html";

let userBalance = 0;
let currentBoxType = null;
let currentDigits = 0;
let currentReward = 0;

const todayDate = new Date().toISOString().substring(0, 10);

window.addEventListener('DOMContentLoaded', async () => {
    // 🎯 इनपुट की लिमिट को रीयल-टाइम में रोकने के लिए इवेंट लिस्नर लगाना
    document.getElementById('pinInput').addEventListener('input', function() {
        if (this.value.length > currentDigits) {
            this.value = this.value.slice(0, currentDigits);
        }
    });
    await syncUserStats();
});

async function syncUserStats() {
    try {
        const userSnap = await getDoc(doc(db, "users", mobile));
        if (userSnap.exists()) {
            userBalance = userSnap.data().balance || 0;
            document.getElementById('userPhoneDisplay').innerText = "Mobile: +91 " + mobile;
            document.getElementById('userBalanceDisplay').innerText = userBalance;
        }

        const limitSnap = await getDoc(doc(db, "users", mobile, "mystery_limit", todayDate));
        let usedAttempts = limitSnap.exists() ? limitSnap.data().count || 0 : 0;
        document.getElementById('remainingAttempts').innerText = 3 - usedAttempts;
    } catch (e) { console.error(e); }
}

// 🔔 कस्टम अलर्ट डिस्प्ले फंक्शन
window.showCustomAlert = (title, msg, iconType) => {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = msg;
    document.getElementById('alertIcon').innerText = iconType === 'success' ? '🎉' : '❌';
    document.getElementById('customAlert').classList.remove('hidden');
};

window.closeAlert = () => {
    document.getElementById('customAlert').classList.add('hidden');
};

window.openPinModal = async (boxType, digits, reward) => {
    // 1. तुरंत लोकल स्टोरेज/फायरबेस से लिमिट चेक करें
    const limitSnap = await getDoc(doc(db, "users", mobile, "mystery_limit", todayDate));
    const usedAttempts = limitSnap.exists() ? limitSnap.data().count || 0 : 0;
    
    if (usedAttempts >= 3) {
        showCustomAlert("Limit Exceeded! 🚨", "आप एक दिन में केवल 3 बार ही मिस्ट्री बॉक्स खोल सकते हैं। कल दोबारा ट्राई करें!", "error");
        return;
    }

    if (userBalance < 1000) {
        showCustomAlert("Low Balance! ❌", "मिस्ट्री बॉक्स खोलने के लिए मिनिमम 1,000 Assets होना जरूरी है।", "error");
        return;
    }

    currentBoxType = boxType;
    currentDigits = digits;
    currentReward = reward;

    const pinInp = document.getElementById('pinInput');
    pinInp.value = "";
    pinInp.placeholder = `${digits} Digit PIN`;
    
    document.getElementById('modalTitle').innerText = boxType === 3 ? "👑 Jackpot Box" : `🎁 Open Box ${boxType}`;
    document.getElementById('pinModal').classList.remove('hidden');
};

window.closePinModal = () => {
    document.getElementById('pinModal').classList.add('hidden');
};

// ⚡ पलक झपकते उत्तर देने वाला मुख्य अट्रैक्शन लॉजिक
window.attemptUnlock = async () => {
    const userPinInput = document.getElementById('pinInput').value.trim();
    if (userPinInput.length !== currentDigits) {
        alert(`Please enter a full ${currentDigits} digit PIN!`);
        return;
    }

    closePinModal();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;

    try {
        const userRef = doc(db, "users", mobile);
        const limitRef = doc(db, "users", mobile, "mystery_limit", todayDate);

        // पलक झपकते रिस्पांस के लिए हम एक साथ दोनों डॉक्यूमेंट रीड कर रहे हैं
        const [userDoc, limitDoc] = await Promise.all([getDoc(userRef), getDoc(limitRef)]);
        
        const latestBalance = userDoc.data().balance || 0;
        const currentCount = limitDoc.exists() ? limitDoc.data().count || 0 : 0;

        if (latestBalance < 1000 || currentCount >= 3) {
            submitBtn.disabled = false;
            return;
        }

        // रैंडम सीक्रेट पिन जनरेशन लॉजिक
        let generatedCorrectPin = "";
        if (currentBoxType === 1) {
            generatedCorrectPin = Math.floor(Math.random() * 10).toString(); // 1 अंक (0-9)
        } else if (currentBoxType === 2) {
            generatedCorrectPin = Math.floor(100 + Math.random() * 900).toString(); // 3 अंक (100-999)
        } else if (currentBoxType === 3) {
            generatedCorrectPin = "LOCK-99K"; // मास्टर ट्रैप
        }

        // फीस डिटेक्शन और लिमिट अपडेट (एक साथ)
        const finalFeesBalance = latestBalance - 1000;
        await Promise.all([
            setDoc(userRef, { balance: finalFeesBalance }, { merge: true }),
            setDoc(limitRef, { count: currentCount + 1 })
        ]);

        if (userPinInput === generatedCorrectPin) {
            // Winner! 🎉
            const finalWinBalance = finalFeesBalance + currentReward;
            await setDoc(userRef, { balance: finalWinBalance }, { merge: true });
            document.getElementById('winSound').play();
            showCustomAlert("Boom! Perfect Match! 🎉", `आपका PIN बिल्कुल सही निकला! आपको +${currentReward} Assets मिले हैं।`, "success");
        } else {
            // Loser! ❌
            document.getElementById('failSound').play();
            let showPin = currentBoxType === 3 ? Math.floor(10000000 + Math.random() * 90000000).toString() : generatedCorrectPin;
            showCustomAlert("Wrong PIN! ❌", `ओह! गलत पिन। Correct PIN "${showPin}" था। आपके खाते से 1,000 Assets कट गए हैं।`, "error");
        }

        await syncUserStats();
    } catch (e) { console.error(e); }
    submitBtn.disabled = false;
};

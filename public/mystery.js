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
if (!mobile) window.location.href = "index.html"; // सुरक्षा: बिना नंबर के बाहर निकालें

let userBalance = 0;
let currentBoxType = null;
let currentDigits = 0;
let currentReward = 0;

// आज की तारीख प्राप्त करें (उदा. "2026-05-15")
const todayDate = new Date().toISOString().substring(0, 10);

// पेज लोड होते ही डेटा सिंक करना
window.addEventListener('DOMContentLoaded', async () => {
    await syncUserStats();
});

async function syncUserStats() {
    try {
        // 1. बैलेंस और मोबाइल लोड करें
        const userSnap = await getDoc(doc(db, "users", mobile));
        if (userSnap.exists()) {
            userBalance = userSnap.data().balance || 0;
            document.getElementById('userPhoneDisplay').innerText = "मोबाइल: +91 " + mobile;
            document.getElementById('userBalanceDisplay').innerText = userBalance;
        }

        // 2. आज की डेली लिमिट लोड करें
        const limitSnap = await getDoc(doc(db, "users", mobile, "mystery_limit", todayDate));
        let usedAttempts = 0;
        if (limitSnap.exists()) {
            usedAttempts = limitSnap.data().count || 0;
        }
        document.getElementById('remainingAttempts').innerText = 10 - usedAttempts;

    } catch (e) { console.error("Sync Error:", e); }
}

// मॉडल ओपन करना
window.openPinModal = async (boxType, digits, reward) => {
    // डेली लिमिट चेक करें
    const limitSnap = await getDoc(doc(db, "users", mobile, "mystery_limit", todayDate));
    const usedAttempts = limitSnap.exists() ? limitSnap.data().count || 0 : 0;
    if (usedAttempts >= 10) {
        alert("🚨 आज की लिमिट समाप्त! आप एक दिन में केवल 10 बार ही मिस्ट्री बॉक्स खोल सकते हैं। कल दोबारा खेलें।");
        return;
    }

    // बैलेंस चेक करें
    if (userBalance < 1000) {
        alert("❌ अपर्याप्त बैलेंस! मिस्ट्री बॉक्स खेलने के लिए कम से कम 1,000 एसेट्स होना जरूरी है।");
        return;
    }

    currentBoxType = boxType;
    currentDigits = digits;
    currentReward = reward;

    document.getElementById('pinInput').value = "";
    document.getElementById('modalTitle').innerText = boxType === 3 ? "👑 महा जैकपॉट अनलॉक करें" : `🎁 बॉक्स ${boxType} अनलॉक करें`;
    document.getElementById('pinInput').maxLength = digits;
    document.getElementById('pinModal').classList.remove('hidden');
};

window.closePinModal = () => {
    document.getElementById('pinModal').classList.add('hidden');
};

// 🔮 भाग्य आजमाने का मुख्य गेमप्ले लॉजिक
window.attemptUnlock = async () => {
    const userPinInput = document.getElementById('pinInput').value.trim();
    if (userPinInput.length !== currentDigits) {
        alert(`कृपया पूरे ${currentDigits} अंकों का पिन दर्ज करें!`);
        return;
    }

    closePinModal();

    try {
        // 1. दोबारा रीयल-टाइम लिमिट और बैलेंस की जांच (सुरक्षा के लिए)
        const userRef = doc(db, "users", mobile);
        const userDoc = await getDoc(userRef);
        const latestBalance = userDoc.data().balance || 0;

        if (latestBalance < 1000) return alert("बैलेंस कम है!");

        const limitRef = doc(db, "users", mobile, "mystery_limit", todayDate);
        const limitDoc = await getDoc(limitRef);
        const currentCount = limitDoc.exists() ? limitDoc.data().count || 0 : 0;
        if (currentCount >= 10) return alert("आज के चांस खत्म!");

        // 2. रीयल-टाइम में गुप्त पिन जनरेट करें (स्कैम प्रूफ)
        let generatedCorrectPin = "";
        
        if (currentBoxType === 1) {
            // 1 अंक का रैंडम पिन (0 से 9)
            generatedCorrectPin = Math.floor(Math.random() * 10).toString();
        } else if (currentBoxType === 2) {
            // 3 अंकों का रैंडम पिन (100 से 999)
            generatedCorrectPin = Math.floor(100 + Math.random() * 900).toString();
        } else if (currentBoxType === 3) {
            // बॉक्स 3: हमेशा गलत करना है, इसलिए इनपुट से अलग कुछ भी बना दो
            generatedCorrectPin = "TRA-99999999"; 
        }

        // 3. फीस काटें और डेली काउंट +1 करें
        const finalFeesBalance = latestBalance - 1000;
        await setDoc(userRef, { balance: finalFeesBalance }, { merge: true });
        await setDoc(limitRef, { count: currentCount + 1 });

        // 4. परिणाम की जांच
        if (userPinInput === generatedCorrectPin) {
            // 🎉 जीत गए!
            const finalWinBalance = finalFeesBalance + currentReward;
            await setDoc(userRef, { balance: finalWinBalance }, { merge: true });
            
            document.getElementById('winSound').play();
            alert(`🎉 शानदार जीत!! आपका पिन एकदम सही था। आपको +${currentReward} डिजिटल एसेट मिले हैं!`);
        } else {
            // ❌ हार गए!
            document.getElementById('failSound').play();
            alert(`❌ ओह! गलत पिन। सही पिन "${boxTypeMessage(currentBoxType, generatedCorrectPin)}" था। आपके 1,000 सिक्के कट गए हैं। दोबारा प्रयास करें!`);
        }

        // स्क्रीन रिफ्रेश किए बिना वॉलेट अपडेट करें
        await syncUserStats();

    } catch (e) { alert("गेम एरर: " + e.message); }
};

function boxTypeMessage(box, correctPin) {
    if (box === 3) {
        // बॉक्स 3 में हमेशा रैंडम 8 अंकों का नंबर दिखाएं ताकि उसे लगे कि वो चूक गया
        return Math.floor(10000000 + Math.random() * 90000000).toString();
    }
    return correctPin;
}

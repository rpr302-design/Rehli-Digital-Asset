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

let wonCoins = 0;
const mobile = localStorage.getItem('userMobile');

// 🎯 [स्मार्ट गेटकीपर] - पेज लोड होते ही सही स्क्रीन का चुनाव
window.addEventListener('DOMContentLoaded', async () => {
    if (mobile) {
        // अगर पुराना यूजर है -> डायरेक्ट डैशबोर्ड एक्टिव करें
        document.getElementById('dashboardContainer').classList.remove('hidden-screen');
        document.getElementById('authContainer').classList.add('hidden-screen');
        await loadDashboardData();
    } else {
        // अगर नया यूजर है -> लॉगिन/चाबी स्क्रीन एक्टिव करें
        document.getElementById('authContainer').classList.remove('hidden-screen');
        document.getElementById('dashboardContainer').classList.add('hidden-screen');
    }
});

// डैशबोर्ड में पुराने सिक्कों का रीयल-टाइम डेटा लोड करना
async function loadDashboardData() {
    try {
        const userSnap = await getDoc(doc(db, "users", mobile));
        if (userSnap.exists()) {
            const data = userSnap.data();
            document.getElementById('dashUserName').innerText = "नमस्ते, " + (data.userName || "यूजर") + "! 👋";
            document.getElementById('dashUserPhone').innerText = "+91 " + mobile;
            document.getElementById('dashBalance').innerText = data.balance || 0;
        } else {
            // सुरक्षा के लिए: अगर लोकलस्टोरेज में नंबर है पर फायरबेस में नहीं
            localStorage.removeItem('userMobile');
            location.reload();
        }
    } catch (e) { console.error("Error loading dashboard:", e); }
}

// 1. नया यूजर: पहली बार चाबी वेरिफाई करना
window.verifyKey = async () => {
    const key = document.getElementById('userKey').value;
    if (key.length !== 5) return alert("कृपया 5 अंकों की सही चाबी डालें।");

    try {
        const assetSnap = await getDoc(doc(db, "assets", key));
        if (assetSnap.exists()) {
            wonCoins = assetSnap.data().value || 100;
            document.getElementById('winSound').play();
            document.getElementById('keySection').style.display = 'none';
            document.getElementById('rewardSection').style.display = 'block';
            document.getElementById('winAmount').innerText = wonCoins + " COINS";
        } else {
            alert("गलत चाबी! कृपया वीडियो फिर से देखें।");
        }
    } catch (e) { alert("सर्वर एरर!"); }
};

window.showMobileInput = () => {
    document.getElementById('claimBtn').style.display = 'none';
    document.getElementById('mobileBox').style.display = 'block';
};

// 2. नया यूजर: मोबाइल नंबर डालकर डेटाबेस में खाता बनाना
window.saveMobile = async () => {
    const inputMobile = document.getElementById('userMobile').value.trim();
    if (inputMobile.length !== 10) return alert("कृपया 10 अंकों का सही मोबाइल नंबर डालें।");

    try {
        const userRef = doc(db, "users", inputMobile);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // नया अकाउंट पहली बार बनाएँ
            await setDoc(userRef, {
                mobile: inputMobile,
                balance: wonCoins,
                regDate: new Date().toISOString(),
                status: "new"
            });
            alert("सफलता! आपका नया खाता बन गया है और सिक्के जोड़ दिए गए हैं।");
        } else {
            // यदि नंबर पहले से मौजूद था
            const currentBal = userSnap.data().balance || 0;
            await setDoc(userRef, { balance: currentBal + wonCoins }, { merge: true });
            alert("सिक्के आपके मौजूदा खाते में जोड़ दिए गए हैं।");
        }

        localStorage.setItem('userMobile', inputMobile);
        location.reload(); // रिफ्रेश होते ही डायरेक्ट डैशबोर्ड पर लैंड करेगा
    } catch (e) { alert("डेटा सुरक्षित करने में एरर!"); }
};

// 3. पुराना यूजर (डैशबोर्ड): नए वीडियो की चाबी डालकर पुराने सिक्कों में इजाफा करना
window.processDashKey = async () => {
    const key = document.getElementById('dashSecretKey').value;
    if (key.length !== 5) return alert("कृपया 5 अंकों की सही चाबी डालें!");

    try {
        const assetSnap = await getDoc(doc(db, "assets", key));
        if (!assetSnap.exists()) return alert("गलत चाबी! कृपया सही चाबी डालें। ❌");

        const winValue = assetSnap.data().value || 0;
        
        // यूजर के खाते से पुराना बैलेंस निकालना
        const userRef = doc(db, "users", mobile);
        const userDoc = await getDoc(userRef);
        const currentBal = userDoc.data().balance || 0;

        // पुराने सिक्कों में नए सिक्के प्लस (Add) करना
        await setDoc(userRef, { balance: currentBal + winValue }, { merge: true });
        
        alert(`शानदार! +${winValue} एसेट्स आपके पुराने सिक्कों में जोड़ दिए गए हैं। 🎉`);
        document.getElementById('dashSecretKey').value = ""; // इनपुट साफ़ करें
        await loadDashboardData(); // बिना पेज रीफ्रेश किए लाइव बैलेंस अपडेट करें
    } catch (e) { alert("एरर: " + e.message); }
};

// निकास (लॉगआउट)
window.logout = () => {
    localStorage.removeItem('userMobile');
    location.reload();
};

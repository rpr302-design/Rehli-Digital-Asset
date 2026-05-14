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

// [गेटकीपर लॉजिक] - पेज लोड होते ही चेक करें यूजर नया है या पुराना
window.addEventListener('DOMContentLoaded', async () => {
    if (mobile) {
        // पुराना यूजर है - डैशबोर्ड कंटेनर दिखाएँ
        document.getElementById('dashboardContainer').style.display = 'block';
        document.getElementById('authContainer').style.display = 'none';
        await loadDashboardData();
    } else {
        // नया यूजर है - चाबी/लॉगिन कंटेनर दिखाएँ
        document.getElementById('authContainer').style.display = 'flex';
        document.getElementById('dashboardContainer').style.display = 'none';
    }
});

// डैशबोर्ड में डेटा लोड करना
async function loadDashboardData() {
    try {
        const userSnap = await getDoc(doc(db, "users", mobile));
        if (userSnap.exists()) {
            const data = userSnap.data();
            document.getElementById('dashUserName').innerText = "नमस्ते, " + (data.userName || "यूजर") + "!";
            document.getElementById('dashUserPhone').innerText = "+91 " + mobile;
            document.getElementById('dashBalance').innerText = data.balance || 0;
        }
    } catch (e) { console.error("Error loading dashboard:", e); }
}

// 1. नया यूजर: चाबी चेक करना
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

// 2. नया यूजर: मोबाइल नंबर डालकर अकाउंट बनाना और कॉइन ऐड करना
window.saveMobile = async () => {
    const inputMobile = document.getElementById('userMobile').value.trim();
    if (inputMobile.length !== 10) return alert("कृपया 10 अंकों का सही मोबाइल नंबर डालें।");

    try {
        const userRef = doc(db, "users", inputMobile);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // नया अकाउंट फ़ायरबेस में बनाएँ
            await setDoc(userRef, {
                mobile: inputMobile,
                balance: wonCoins,
                regDate: new Date().toISOString(),
                status: "new"
            });
            alert("बधाई हो! आपका अकाउंट बन गया है और सिक्के जोड़ दिए गए हैं।");
        } else {
            // अगर नंबर पहले से है, तो सिर्फ कॉइन जोड़ें
            const currentBal = userSnap.data().balance || 0;
            await setDoc(userRef, { balance: currentBal + wonCoins }, { merge: true });
            alert("सिक्के आपके मौजूदा खाते में जोड़ दिए गए हैं।");
        }

        localStorage.setItem('userMobile', inputMobile);
        location.reload(); // पेज रिफ्रेश होकर सीधे डैशबोर्ड खुल जाएगा
    } catch (e) { alert("डेटा सुरक्षित करने में त्रुटि आई!"); }
};

// 3. डैशबोर्ड के अंदर से नई चाबी क्लेम करना
window.processDashKey = async () => {
    const key = document.getElementById('dashSecretKey').value;
    if (key.length !== 5) return alert("5 अंकों की चाबी डालें!");

    try {
        const assetSnap = await getDoc(doc(db, "assets", key));
        if (!assetSnap.exists()) return alert("गलत चाबी! ❌");

        // चेक करें क्या चाबी पहले इस्तेमाल तो नहीं हुई
        const userSnap = await getDoc(doc(db, "users", mobile));
        const winValue = assetSnap.data().value || 0;
        const currentBal = userSnap.data().balance || 0;

        await setDoc(doc(db, "users", mobile), { balance: currentBal + winValue }, { merge: true });
        alert(`सफलता! +${winValue} एसेट आपके वॉलेट में जुड़ गए।`);
        location.reload();
    } catch (e) { alert("एरर: " + e.message); }
};

// लॉगआउट
window.logout = () => {
    localStorage.removeItem('userMobile');
    location.reload();
};

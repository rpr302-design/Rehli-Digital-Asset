import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAuqo9MoZ9lr4STXztO36n0ASqHOytdAeI",
    authDomain: "rehli-digital-asset.firebaseapp.com",
    projectId: "rehli-digital-asset",
    storageBucket: "rehli-digital-asset.firebasestorage.app",
    messagingSenderId: "779415089179",
    appId: "1:779415089179:web:4f6654088af999ed7ac8be"
    // वर्तमान वर्ष: 2026
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let wonCoins = 0;
let tempVerifiedKey = "";
let html5QrcodeScanner = null;
const mobile = localStorage.getItem('userMobile');

// 🎯 [स्मार्ट गेटकीपर और पेज इनिशियलाइज़र]
window.addEventListener('DOMContentLoaded', async () => {
    if (mobile) {
        document.getElementById('dashboardContainer').classList.remove('hidden-screen');
        document.getElementById('authContainer').classList.add('hidden-screen');
        await loadDashboardData();
        await promoteUnusedVideo(); // अन-यूज्ड वीडियो दिखाएँ
    } else {
        document.getElementById('authContainer').classList.remove('hidden-screen');
        document.getElementById('dashboardContainer').classList.add('hidden-screen');
    }
});

// 🔔 सेन्टर रंगीन कस्टम अलर्ट मैनेजर
window.showCustomAlert = (title, msg, type) => {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = msg;
    document.getElementById('alertIcon').innerText = type === 'success' ? '🎉' : '❌';
    document.getElementById('customAlert').classList.remove('hidden-screen');
};

window.closeAlert = () => {
    document.getElementById('customAlert').classList.add('hidden-screen');
};

// डैशबोर्ड लाइव डेटा सिंक
async function loadDashboardData() {
    try {
        const userSnap = await getDoc(doc(db, "users", mobile));
        if (userSnap.exists()) {
            const data = userSnap.data();
            document.getElementById('dashUserName').innerText = "नमस्ते, " + (data.userName || "यूज़र") + "! 👋";
            document.getElementById('dashUserPhone').innerText = "+91 " + mobile;
            document.getElementById('dashBalance').innerText = data.balance || 0;
        } else {
            localStorage.removeItem('userMobile');
            location.reload();
        }
    } catch (e) { console.error(e); }
}

// 📺 लेटेस्ट अन-यूज्ड वीडियो प्रमोटर एल्गोरिथ्म
async function promoteUnusedVideo() {
    try {
        // 1. एसेट्स कलेक्शन से लेटेस्ट एक्टिव वीडियो निकालें
        const qAssets = query(collection(db, "assets"), where("status", "==", "active"), orderBy("timestamp", "desc"), limit(5));
        const assetsSnap = await getDocs(qAssets);
        if (assetsSnap.empty) return;

        // 2. यूजर द्वारा उपयोग की जा चुकी चाबियाँ निकालें
        const usedKeysSnap = await getDocs(collection(db, "users", mobile, "used_keys"));
        const usedKeysList = [];
        usedKeysSnap.forEach(docSnap => usedKeysList.push(docSnap.id));

        // 3. मैच करें कि कौन सी लेटेस्ट चाबी यूजर ने अभी तक इस्तेमाल नहीं की है
        let promoAsset = null;
        assetsSnap.forEach(docSnap => {
            if (!usedKeysList.includes(docSnap.id) && !promoAsset) {
                promoAsset = docSnap.data();
            }
        });

        // 4. अगर ऐसी कोई चाबी मिलती है, तो उसका वीडियो विजेट दिखाएँ
        if (promoAsset && promoAsset.link) {
            document.getElementById('lblPromoTitle').innerText = promoAsset.title || "नया वीडियो आ गया है!";
            document.getElementById('btnPromoLink').href = promoAsset.link;
            document.getElementById('promoVideoSection').classList.remove('hidden-screen');
        } else {
            document.getElementById('promoVideoSection').classList.add('hidden-screen');
        }
    } catch (e) { console.error("Promo Engine Error:", e); }
}

// 🔐 एंटी-चीट चाबी चेकर नियम (महीने में 1 बार पाबंदी)
async function isKeyAllowedForUser(userMobile, keyNumber) {
    const usedKeyRef = doc(db, "users", userMobile, "used_keys", keyNumber);
    const usedKeySnap = await getDoc(usedKeyRef);

    if (usedKeySnap.exists()) {
        const lastClaimedStr = usedKeySnap.data().claimedAt;
        if (lastClaimedStr) {
            const lastClaimedDate = new Date(lastClaimedStr);
            const currentServerDate = new Date();
            
            // 30 दिनों का सख्त सुरक्षा लॉक (1 महीना फ्रीज)
            const diffTime = Math.abs(currentServerDate - lastClaimedDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 30) return false; // अनुमति नहीं है
        }
    }
    return true; // अनुमति है
}

// 1. नया यूजर: पहली बार चाबी जांचना
window.verifyKey = async () => {
    const key = document.getElementById('userKey').value.trim();
    if (key.length !== 5) return showCustomAlert("Invalid Key ❌", "कृपया 5 अंकों की सही चाबी डालें।", "error");

    try {
        const assetSnap = await getDoc(doc(db, "assets", key));
        if (!assetSnap.exists()) return showCustomAlert("Error ❌", "गलत चाबी! कृपया वीडियो दोबारा ध्यान से देखें।", "error");

        wonCoins = assetSnap.data().value || 100;
        tempVerifiedKey = key;

        document.getElementById('winSound').play();
        document.getElementById('keySection').style.display = 'none';
        document.getElementById('rewardSection').style.display = 'block';
        document.getElementById('winAmount').innerText = wonCoins + " COINS";
    } catch (e) { showCustomAlert("Error", "सर्वर एरर!", "error"); }
};

window.showMobileInput = () => {
    document.getElementById('claimBtn').style.display = 'none';
    document.getElementById('mobileBox').style.display = 'block';
};

// 2. नया यूजर: मोबाइल नंबर डालकर परमानेंट अकाउंट लॉक करना
window.saveMobile = async () => {
    const inputMobile = document.getElementById('userMobile').value.trim();
    if (inputMobile.length !== 10) return showCustomAlert("Error", "10 अंकों का नंबर डालें!", "error");

    try {
        // एंटी-चीट डबल लॉक चेक
        const isAllowed = await isKeyAllowedForUser(inputMobile, tempVerifiedKey);
        if (!isAllowed) return showCustomAlert("Anti-Cheat Alert 🚨", "आप इस चाबी का उपयोग महीने में केवल एक बार ही कर सकते हैं!", "error");

        const userRef = doc(db, "users", inputMobile);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            await setDoc(userRef, { mobile: inputMobile, balance: wonCoins, regDate: new Date().toISOString() });
        } else {
            const currentBal = userSnap.data().balance || 0;
            await setDoc(userRef, { balance: currentBal + wonCoins }, { merge: true });
        }

        //used_keys में रिकॉर्ड दर्ज करें
        await setDoc(doc(db, "users", inputMobile, "used_keys", tempVerifiedKey), {
            key: tempVerifiedKey, amount: wonCoins, claimedAt: new Date().toISOString()
        });

        localStorage.setItem('userMobile', inputMobile);
        showCustomAlert("Success 🎉", "खाता सुरक्षित बन गया और एसेट क्रेडिट हो गए।", "success");
        setTimeout(() => location.reload(), 2000);
    } catch (e) { showCustomAlert("Error", "डेटा सुरक्षित करने में विफल!", "error"); }
};

// 3. पुराना यूजर (डैशबोर्ड): नई चाबी क्लेम करना (सख्त डबल एंट्री प्रोटेक्शन)
window.processDashKey = async () => {
    const key = document.getElementById('dashSecretKey').value.trim();
    if (key.length !== 5) return showCustomAlert("Error", "5 अंकों की चाबी डालें!", "error");

    try {
        const isAllowed = await isKeyAllowedForUser(mobile, key);
        if (!isAllowed) return showCustomAlert("प्रवेश निषेध 🚨", "आप इस वीडियो कोड का उपयोग इस महीने पहले ही कर चुके हैं।", "error");

        const assetSnap = await getDoc(doc(db, "assets", key));
        if (!assetSnap.exists()) return showCustomAlert("Wrong Key ❌", "गलत चाबी! कृपया नया वीडियो देखें।", "error");

        const winValue = assetSnap.data().value || 0;
        const userRef = doc(db, "users", mobile);
        const userDoc = await getDoc(userRef);
        const currentBal = userDoc.data().balance || 0;

        // बैलेंस अपडेट करें
        await setDoc(userRef, { balance: currentBal + winValue }, { merge: true });
        // इतिहास लॉक करें
        await setDoc(doc(db, "users", mobile, "used_keys", key), {
            key: key, amount: winValue, claimedAt: new Date().toISOString()
        });

        document.getElementById('winSound').play();
        showCustomAlert("Claimed! 🎉", `सफलता! आपके वॉलेट में +${winValue} कॉइन जुड़ गए।`, "success");
        document.getElementById('dashSecretKey').value = "";
        await loadDashboardData();
        await promoteUnusedVideo();
    } catch (e) { showCustomAlert("Error", "क्लेम फेल हुआ!", "error"); }
};

// =================== 💸 [फिनटेक मर्चेंट पेमेंट मॉड्यूल] ===================

window.openPaymentModal = () => {
    document.getElementById('payMerchantMobile').value = "";
    document.getElementById('payAmount').value = "";
    document.getElementById('payBillAmount').value = "";
    document.getElementById('paymentModal').classList.remove('hidden-screen');
};

window.closePaymentModal = () => {
    stopQRScanner();
    document.getElementById('paymentModal').classList.add('hidden-screen');
};

// 📷 लाइव क्यूआर कोड स्कैनर चालू करना
window.startQRScanner = () => {
    document.getElementById('qrReaderContainer').classList.remove('hidden-screen');
    document.getElementById('btnStartScan').classList.add('hidden-screen');
    
    html5QrcodeScanner = new Html5Qrcode("qrReader");
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (qrText) => {
            // यदि सही मर्चेंट क्यूआर मिलता है (Format: REHLI-PAY:MOBILE)
            if (qrText.startsWith("REHLI-PAY:")) {
                const merchantNum = qrText.split(":")[1];
                document.getElementById('payMerchantMobile').value = merchantNum;
                stopQRScanner();
                showCustomAlert("QR Scanned! ✅", "दुकानदार का नंबर लोड हो गया है। राशि भरें।", "success");
            }
        },
        (errorMessage) => { /* स्कैनिंग कंटीन्यू */ }
    ).catch(err => { console.error(err); });
};

window.stopQRScanner = () => {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            document.getElementById('qrReaderContainer').classList.add('hidden-screen');
            document.getElementById('btnStartScan').classList.remove('hidden-screen');
        }).catch(err => console.log(err));
    }
};

// 💳 लाइव बिजनेस लिमिट्स वेरिफ़िकेशन और एसेट ट्रांसफर
window.processPayment = async () => {
    const mMobile = document.getElementById('payMerchantMobile').value.trim();
    const amountStr = document.getElementById('payAmount').value;
    const billStr = document.getElementById('payBillAmount').value;

    if (mMobile.length !== 10 || !amountStr || !billStr) {
        return showCustomAlert("Error", "कृपया दुकानदार का नंबर, एसेट राशि और बिल भरें!", "error");
    }

    const payAmount = Number(amountStr);
    const billAmount = Number(billStr);

    try {
        // 1. दुकानदार का डेटाबेस रिकॉर्ड और उसकी सेट की गई लिमिट्स निकालें
        const mSnap = await getDoc(doc(db, "merchants", mMobile));
        if (!mSnap.exists()) return showCustomAlert("Payment Failed ❌", "यह दुकानदार डिजिटल नेटवर्क पर पंजीकृत नहीं है।", "error");

        const mData = mSnap.data();
        const perTxnLimit = mData.perTxnLimit || 5000;
        const minBillAmount = mData.minBillAmount || 100;

        // 2. दुकानदार द्वारा तय नियम और बिल राशि की जाँच करें
        if (billAmount < minBillAmount) {
            return showCustomAlert("Limit Block ❌", `इस दुकान पर एसेट भुनाने के लिए न्यूनतम बिल राशि ₹${minBillAmount} होनी चाहिए।`, "error");
        }
        if (payAmount > perTxnLimit) {
            return showCustomAlert("Limit Block ❌", `यह दुकानदार एक बार में अधिकतम ${perTxnLimit} एसेट ही स्वीकार कर सकता है।`, "error");
        }

        // 3. यूजर के बैलेंस की रीयल-टाइम जांच
        const userRef = doc(db, "users", mobile);
        const userDoc = await getDoc(userRef);
        const userCurrentBal = userDoc.data().balance || 0;

        if (userCurrentBal < payAmount) return showCustomAlert("Low Balance ❌", "आपके पास भुगतान करने के लिए पर्याप्त एसेट्स नहीं हैं!", "error");

        // 4. पेमेंट एग्जीक्यूट करें (यूजर से माइनस, मर्चेंट में प्लस, ट्रांजैक्शन लॉग जनरेट)
        const newTxRef = doc(collection(db, "merchant_transactions"));
        const currentMerchantBalance = mData.balance || 0;

        await Promise.all([
            setDoc(userRef, { balance: userCurrentBal - payAmount }, { merge: true }), // यूजर वॉलेट अपडेट
            setDoc(doc(db, "merchants", mMobile), { balance: currentMerchantBalance + payAmount }, { merge: true }), // मर्चेंट वॉलेट अपडेट
            setDoc(newTxRef, {
                txId: newTxRef.id, userMobile: mobile, merchantMobile: mMobile,
                amount: payAmount, billAmount: billAmount, timestamp: new Date().toISOString()
            }) // लेनदेन लॉग सुरक्षित करना
        ]);

        closePaymentModal();
        showCustomAlert("Success! 💸", `सफलतापूर्वक ${payAmount} एसेट दुकानदार को ट्रांसफर कर दिए गए हैं।`, "success");
        await loadDashboardData(); // वॉलेट बैलेंस लाइव रिफ्रेश करें

    } catch (e) { showCustomAlert("Error", "भुगतान प्रक्रिया विफल: " + e.message, "error"); }
};

window.logout = () => {
    localStorage.removeItem('userMobile');
    location.reload();
};

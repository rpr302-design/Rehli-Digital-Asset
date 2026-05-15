import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

let html5QrcodeScanner = null;
let targetMerchantData = null;

// मिस्ट्री बॉक्स स्टेट ट्रैकर्स
let mBoxType = 0, mDigits = 0, mReward = 0;

const mobile = localStorage.getItem('userMobile');
const todayDate = new Date().toISOString().substring(0, 10);

// 🎯 [भाग 1: स्मार्ट गेटकीपर और फ़ायरबेस रीड कंट्रोलर]
window.addEventListener('DOMContentLoaded', async () => {
    if (mobile) {
        document.getElementById('dashboardContainer').classList.remove('hidden-screen');
        document.getElementById('authContainer').classList.add('hidden-screen');
        document.getElementById('profMobile').innerText = mobile;
        
        // इन-ऐप टैब और लोकल कैशिंग को लोड करें
        switchAppTab('home');
        await loadCachedDashboard();
    } else {
        document.getElementById('authContainer').classList.remove('hidden-screen');
        document.getElementById('dashboardContainer').classList.add('hidden-screen');
    }
});

// 🔒 [यूनिक रीफ्रेश प्रोटेक्शन]: फ़ायरबेस रीड्स को 90% कम करने के लिए सेशन मेमोरी का उपयोग
async function loadCachedDashboard(forceRefresh = false) {
    const cachedName = sessionStorage.getItem('cash_name');
    const cachedBal = sessionStorage.getItem('cash_balance');

    if (cachedName && cachedBal && !forceRefresh) {
        // अगर मेमोरी में डेटा है, तो फ़ायरबेस कॉल नहीं होगी (0 Reads खर्च)
        renderDashboardUI(cachedName, cachedBal);
        renderCachedPromoVideo();
    } else {
        // केवल पहली बार या डेटा बदलने पर ही फ़ायरबेस से लोड होगा
        try {
            const userSnap = await getDoc(doc(db, "users", mobile));
            if (userSnap.exists()) {
                const data = userSnap.data();
                const name = data.userName || "यूज़र";
                const balance = data.balance || 0;
                
                sessionStorage.setItem('cash_name', name);
                sessionStorage.setItem('cash_balance', balance);
                
                renderDashboardUI(name, balance);
                await fetchAndCachePromoVideo(); // वीडियो डेटा सुरक्षित रूप से स्कैन करें
            } else {
                window.logout();
            }
        } catch (e) { console.error(e); }
    }
}

function renderDashboardUI(name, balance) {
    document.getElementById('dashUserName').innerText = `नमस्ते, ${name}! 👋`;
    document.getElementById('dashUserPhone').innerText = "+91 " + mobile;
    document.getElementById('dashBalance').innerText = balance;
}

// 📺 वीडियो विजेट के रीड्स कंट्रोल करना (24 घंटे का लॉक)
function renderCachedPromoVideo() {
    const pTitle = localStorage.getItem('promo_title');
    const pLink = localStorage.getItem('promo_link');
    if (pTitle && pLink) {
        document.getElementById('lblPromoTitle').innerText = pTitle;
        document.getElementById('btnPromoLink').href = pLink;
        document.getElementById('promoVideoSection').classList.remove('hidden-screen');
    }
}

async function fetchAndCachePromoVideo() {
    try {
        const qAssets = query(collection(db, "assets"), where("status", "==", "active"), orderBy("timestamp", "desc"), limit(3));
        const [assetsSnap, usedKeysSnap] = await Promise.all([
            getDocs(qAssets),
            getDocs(collection(db, "users", mobile, "used_keys"))
        ]);
        
        const usedKeysList = [];
        usedKeysSnap.forEach(dk => usedKeysList.push(dk.id));

        let found = false;
        assetsSnap.forEach(dk => {
            if (!usedKeysList.includes(dk.id) && !found) {
                const asset = dk.data();
                localStorage.setItem('promo_title', asset.title || "नया वीडियो क्लेम करें");
                localStorage.setItem('promo_link', asset.link);
                renderCachedPromoVideo();
                found = true;
            }
        });
        if (!found) {
            localStorage.removeItem('promo_title');
            localStorage.removeItem('promo_link');
            document.getElementById('promoVideoSection').classList.add('hidden-screen');
        }
    } catch (e) { console.error(e); }
}

// 📱 इन-ऐप टैब स्विचिंग आर्किटेक्चर (नो न्यू टैब)
window.switchAppTab = async (tabName) => {
    stopQRScanner();
    // सभी टैब और लिंक्स को छुपाएं
    ['home', 'mystery', 'profile', 'pay'].forEach(t => {
        document.getElementById('tab-' + t).classList.add('hidden-screen');
        const link = document.getElementById('nav-' + t);
        if (link) link.classList.remove('active');
    });
    document.getElementById('nav-pay-circle').parentElement.classList.remove('active');

    // एक्टिव टैब को ओपन करें
    document.getElementById('tab-' + tabName).classList.remove('hidden-screen');
    if (tabName === 'pay') {
        document.getElementById('nav-pay-circle').parentElement.classList.add('active');
    } else {
        document.getElementById('nav-' + tabName).classList.add('active');
    }

    // स्पेशल टैब एक्शन्स
    if (tabName === 'mystery') await syncMysteryLimit();
    if (tabName === 'pay') window.openPaymentArea();
};

// 🔔 रंगीन कस्टम अलर्ट
window.showCustomAlert = (title, msg, type) => {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = msg;
    const iconEl = document.getElementById('alertIcon');
    iconEl.innerText = type === 'success' ? '🎉' : '❌';
    iconEl.style.color = type === 'success' ? 'var(--success)' : 'var(--danger)';
    document.getElementById('customAlert').classList.remove('hidden-screen');
};
window.closeAlert = () => document.getElementById('customAlert').classList.add('hidden-screen');

// 🔐 एंटी-चीट चाबी प्रोटेक्शन (महीने में 1 बार लॉक)
async function checkKeyMonthLock(userMobile, key) {
    const snap = await getDoc(doc(db, "users", userMobile, "used_keys", key));
    if (snap.exists()) {
        const claimTime = snap.data().claimedAt;
        if (claimTime) {
            const diff = Math.abs(new Date() - new Date(claimTime));
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            if (days <= 30) return false;
        }
    }
    return true;
}

// चाबी वेरिफिकेशन (नया यूजर)
window.verifyKey = async () => {
    const key = document.getElementById('userKey').value.trim();
    if (key.length !== 5) return showCustomAlert("Invalid ❌", "5 अंकों की सही चाबी डालें।", "error");

    const assetSnap = await getDoc(doc(db, "assets", key));
    if (!assetSnap.exists()) return showCustomAlert("Error ❌", "गलत चाबी! वीडियो दोबारा देखें।", "error");

    wonCoins = assetSnap.data().value || 100;
    tempVerifiedKey = key;
    document.getElementById('winSound').play();
    document.getElementById('keySection').style.display = 'none';
    document.getElementById('rewardSection').style.display = 'block';
    document.getElementById('winAmount').innerText = wonCoins + " COINS";
};

window.showMobileInput = () => {
    document.getElementById('claimBtn').style.display = 'none';
    document.getElementById('mobileBox').style.display = 'block';
};

window.saveMobile = async () => {
    const inputMobile = document.getElementById('userMobile').value.trim();
    if (inputMobile.length !== 10) return showCustomAlert("Error", "10 अंकों का नंबर डालें!", "error");

    const isAllowed = await checkKeyMonthLock(inputMobile, tempVerifiedKey);
    if (!isAllowed) return showCustomAlert("प्रवेश बंद 🚨", "आप इस चाबी का इस्तेमाल इस महीने कर चुके हैं!", "error");

    const userRef = doc(db, "users", inputMobile);
    const userSnap = await getDoc(userRef);
    const finalCoins = userSnap.exists() ? (userSnap.data().balance || 0) + wonCoins : wonCoins;

    await setDoc(userRef, { mobile: inputMobile, balance: finalCoins, regDate: new Date().toISOString() }, { merge: true });
    await setDoc(doc(db, "users", inputMobile, "used_keys", tempVerifiedKey), { key: tempVerifiedKey, amount: wonCoins, claimedAt: new Date().toISOString() });

    localStorage.setItem('userMobile', inputMobile);
    showCustomAlert("Success 🎉", "अकाउंट सफलतापूर्वक एक्टिव हो गया है।", "success");
    setTimeout(() => location.reload(), 1500);
};

// पुराना यूजर: डैशबोर्ड से चाबी क्लेम करना
window.processDashKey = async () => {
    const key = document.getElementById('dashSecretKey').value.trim();
    if (key.length !== 5) return showCustomAlert("Error", "5 अंकों की चाबी डालें!", "error");

    const isAllowed = await checkKeyMonthLock(mobile, key);
    if (!isAllowed) return showCustomAlert("सुरक्षा लॉक 🚨", "इस चाबी का उपयोग आप इस महीने पहले ही कर चुके हैं।", "error");

    const assetSnap = await getDoc(doc(db, "assets", key));
    if (!assetSnap.exists()) return showCustomAlert("Wrong Key ❌", "यह चाबी मान्य नहीं है।", "error");

    const winValue = assetSnap.data().value || 0;
    const userRef = doc(db, "users", mobile);
    const userDoc = await getDoc(userRef);
    const currentBal = userDoc.data().balance || 0;

    const finalBalance = currentBal + winValue;
    await setDoc(userRef, { balance: finalBalance }, { merge: true });
    await setDoc(doc(db, "users", mobile, "used_keys", key), { key: key, amount: winValue, claimedAt: new Date().toISOString() });

    // सेशन और लोकल कैश को साफ़ करें ताकि अगला रीड फ्रेश हो
    sessionStorage.setItem('cash_balance', finalBalance);
    document.getElementById('winSound').play();
    showCustomAlert("Claimed! 🎉", `बधाई हो! +${winValue} सिक्के वॉलेट में जुड़ गए।`, "success");
    document.getElementById('dashSecretKey').value = "";
    
    renderDashboardUI(sessionStorage.getItem('cash_name'), finalBalance);
    await fetchAndCachePromoVideo();
};

// =================== 🔮 [इन-ऐप मिस्ट्री बॉक्स मॉड्यूल] ===================

async function syncMysteryLimit() {
    const limitSnap = await getDoc(doc(db, "users", mobile, "mystery_limit", todayDate));
    const usedAttempts = limitSnap.exists() ? limitSnap.data().count || 0 : 0;
    document.getElementById('remainingAttempts').innerText = 3 - usedAttempts;
}

window.openMysteryPinModal = async (boxType, digits, reward, name) => {
    const limitSnap = await getDoc(doc(db, "users", mobile, "mystery_limit", todayDate));
    const usedAttempts = limitSnap.exists() ? limitSnap.data().count || 0 : 0;
    if (usedAttempts >= 3) return showCustomAlert("Limit Exceeded! 🚨", "आप एक दिन में केवल 3 बार ही मिस्ट्री बॉक्स खोल सकते हैं।", "error");

    const currentBal = Number(sessionStorage.getItem('cash_balance') || 0);
    if (currentBal < 1000) return showCustomAlert("Low Balance ❌", "गेम खेलने के लिए कम से कम 1000 सिक्के चाहिए।", "error");

    mBoxType = boxType; mDigits = digits; mReward = reward;
    const pinInp = document.getElementById('mPinInput');
    pinInp.value = "";
    pinInp.placeholder = `${digits} Digit PIN`;
    document.getElementById('mModalTitle').innerText = `Unlock ${name}`;
    document.getElementById('mysteryModal').classList.remove('hidden-screen');
};

window.closeMysteryModal = () => document.getElementById('mysteryModal').classList.add('hidden-screen');

window.attemptMysteryUnlock = async () => {
    const userPinInput = document.getElementById('mPinInput').value.trim();
    if (userPinInput.length !== mDigits) return alert(`Please enter full ${mDigits} digits!`);

    closeMysteryModal();
    try {
        const userRef = doc(db, "users", mobile);
        const limitRef = doc(db, "users", mobile, "mystery_limit", todayDate);

        const [userDoc, limitDoc] = await Promise.all([getDoc(userRef), getDoc(limitRef)]);
        const latestBalance = userDoc.data().balance || 0;
        const currentCount = limitDoc.exists() ? limitDoc.data().count || 0 : 0;

        if (latestBalance < 1000 || currentCount >= 3) return;

        let correctPin = "";
        if (mBoxType === 1) correctPin = Math.floor(Math.random() * 10).toString();
        else if (mBoxType === 2) correctPin = Math.floor(100 + Math.random() * 900).toString();
        else if (mBoxType === 3) correctPin = "TRAP-99X";

        const feesDeductedBalance = latestBalance - 1000;
        await Promise.all([
            setDoc(userRef, { balance: feesDeductedBalance }, { merge: true }),
            setDoc(limitRef, { count: currentCount + 1 })
        ]);

        if (userPinInput === correctPin) {
            const finalWinBal = feesDeductedBalance + mReward;
            await setDoc(userRef, { balance: finalWinBal }, { merge: true });
            sessionStorage.setItem('cash_balance', finalWinBal);
            document.getElementById('winSound').play();
            showCustomAlert("Winner! 🎉", `पिन मैच हुआ! आपको +${mReward} सिक्के मिले।`, "success");
        } else {
            document.getElementById('failSound').play();
            let showPin = mBoxType === 3 ? Math.floor(10000000 + Math.random() * 90000000).toString() : correctPin;
            sessionStorage.setItem('cash_balance', feesDeductedBalance);
            showCustomAlert("Wrong PIN ❌", `गलत पिन! सही पिन "${showPin}" था। -1000 सिक्के कट गए।`, "error");
        }
        
        renderDashboardUI(sessionStorage.getItem('cash_name'), sessionStorage.getItem('cash_balance'));
        await syncMysteryLimit();
    } catch (e) { console.error(e); }
};

// =================== 💸 [पेटीएम स्टाइल 2-Step पेमेंट गेटवे] ===================

window.openPaymentArea = () => {
    document.getElementById('payMerchantMobile').value = "";
    document.getElementById('payAmount').value = "";
    document.getElementById('payBillAmount').value = "";
    document.getElementById('merchantVerifyArea').classList.add('hidden-screen');
    document.getElementById('paymentFormArea').classList.add('hidden-screen');
    targetMerchantData = null;
};

window.startQRScanner = () => {
    document.getElementById('qrReaderContainer').classList.remove('hidden-screen');
    document.getElementById('btnStartScan').classList.add('hidden-screen');
    
    html5QrcodeScanner = new Html5Qrcode("qrReader");
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 220, height: 220 } },
        async (qrText) => {
            if (qrText.includes("REHLI-PAY:")) {
                const merchantNum = qrText.split(":")[1].trim();
                document.getElementById('payMerchantMobile').value = merchantNum;
                stopQRScanner();
                await verifyAndFetchMerchant(merchantNum);
            }
        },
        (err) => {}
    ).catch(e => console.error(e));
};

window.stopQRScanner = () => {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            document.getElementById('qrReaderContainer').classList.add('hidden-screen');
            document.getElementById('btnStartScan').classList.remove('hidden-screen');
        }).catch(e => console.log(e));
    }
};

window.searchMerchant = async () => {
    const inputNum = document.getElementById('payMerchantMobile').value.trim();
    if (inputNum.length !== 10) return showCustomAlert("Error ❌", "10 अंकों का मर्चेंट नंबर डालें।", "error");
    await verifyAndFetchMerchant(inputNum);
};

async function verifyAndFetchMerchant(shopMobile) {
    try {
        const mSnap = await getDoc(doc(db, "merchants", shopMobile));
        if (!mSnap.exists()) {
            document.getElementById('merchantVerifyArea').classList.add('hidden-screen');
            document.getElementById('paymentFormArea').classList.add('hidden-screen');
            targetMerchantData = null;
            return showCustomAlert("Not Found ❌", "यह दुकानदार डिजिटल नेटवर्क पर नहीं है।", "error");
        }

        targetMerchantData = mSnap.data();
        document.getElementById('lblVerifiedShopName').innerText = targetMerchantData.shopName + " 🏪";
        document.getElementById('lblVerifiedShopPhone').innerText = "Shop ID: +91 " + targetMerchantData.mobile;
        
        const minBill = targetMerchantData.minBillAmount || 100;
        const maxTxn = targetMerchantData.perTxnLimit || 5000;
        document.getElementById('lblShopRulesInfo').innerText = `शर्तें: न्यूनतम बिल ₹${minBill} | मैक्सिमम लिमिट ${maxTxn}`;

        document.getElementById('merchantVerifyArea').classList.remove('hidden-screen');
        document.getElementById('paymentFormArea').classList.remove('hidden-screen');
    } catch (e) { console.error(e); }
}

window.processPayment = async () => {
    if (!targetMerchantData) return;
    const amountStr = document.getElementById('payAmount').value;
    const billStr = document.getElementById('payBillAmount').value;

    if (!amountStr || !billStr) return showCustomAlert("अधूरा फॉर्म ❌", "एसेट राशि और बिल राशि दोनों भरें!", "error");

    const payAmount = Number(amountStr);
    const billAmount = Number(billStr);
    const mMobile = targetMerchantData.mobile;
    const perTxnLimit = targetMerchantData.perTxnLimit || 5000;
    const minBillAmount = targetMerchantData.minBillAmount || 100;

    if (billAmount < minBillAmount) return showCustomAlert("नियम उल्लंघन ❌", `न्यूनतम बिल राशि ₹${minBillAmount} होनी चाहिए।`, "error");
    if (payAmount > perTxnLimit) return showCustomAlert("नियम उल्लंघन ❌", `एक बार में अधिकतम लिमिट ${perTxnLimit} सिक्के है।`, "error");

    try {
        const userRef = doc(db, "users", mobile);
        const userDoc = await getDoc(userRef);
        const userCurrentBal = userDoc.data().balance || 0;

        if (userCurrentBal < payAmount) return showCustomAlert("लो बैलेंस ❌", "वॉलेट में पर्याप्त सिक्के नहीं हैं!", "error");

        const newTxRef = doc(collection(db, "merchant_transactions"));
        const currentMerchantBalance = targetMerchantData.balance || 0;

        const finalUserBal = userCurrentBal - payAmount;
        await Promise.all([
            setDoc(userRef, { balance: finalUserBal }, { merge: true }),
            setDoc(doc(db, "merchants", mMobile), { balance: currentMerchantBalance + payAmount }, { merge: true }),
            setDoc(newTxRef, { txId: newTxRef.id, userMobile: mobile, merchantMobile: mMobile, amount: payAmount, billAmount: billAmount, timestamp: new Date().toISOString() })
        ]);

        sessionStorage.setItem('cash_balance', finalUserBal);
        window.openPaymentArea();
        showCustomAlert("भुगतान सफल! 💸", `सफलतापूर्वक ${payAmount} एसेट ${targetMerchantData.shopName} को ट्रांसफर हो गए।`, "success");
        
        renderDashboardUI(sessionStorage.getItem('cash_name'), finalUserBal);
    } catch (e) { showCustomAlert("Error", "पेमेंट फेल हुआ!", "error"); }
};

window.logout = () => {
    localStorage.removeItem('userMobile');
    sessionStorage.clear(); // सेशन मेमोरी साफ़ करें
    location.reload();
};

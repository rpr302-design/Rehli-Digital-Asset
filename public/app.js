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
let mBoxType = 0, mDigits = 0, mReward = 0;

const mobile = localStorage.getItem('userMobile');
const todayDate = new Date().toISOString().substring(0, 10);

// 🎯 [स्मार्ट गेटकीपर और इन-ऐप मैनेजर]
window.addEventListener('DOMContentLoaded', async () => {
    if (mobile) {
        document.getElementById('dashboardContainer').classList.remove('hidden-screen');
        document.getElementById('authContainer').classList.add('hidden-screen');
        document.getElementById('profMobile').innerText = mobile;
        
        switchAppTab('home');
        await loadCachedDashboard();
    } else {
        document.getElementById('authContainer').classList.remove('hidden-screen');
        document.getElementById('dashboardContainer').classList.add('hidden-screen');
    }
});

// फ़ायरबेस रीड्स को कम करने के लिए सेशन मेमोरी का उपयोग
async function loadCachedDashboard(forceRefresh = false) {
    const cachedName = sessionStorage.getItem('cash_name');
    const cachedBal = sessionStorage.getItem('cash_balance');

    if (cachedName && cachedBal && !forceRefresh) {
        renderDashboardUI(cachedName, cachedBal);
        renderCachedPromoVideo();
    } else {
        try {
            const userSnap = await getDoc(doc(db, "users", mobile));
            if (userSnap.exists()) {
                const data = userSnap.data();
                const name = data.userName || "यूज़र";
                const balance = data.balance || 0;
                
                sessionStorage.setItem('cash_name', name);
                sessionStorage.setItem('cash_balance', balance);
                
                renderDashboardUI(name, balance);
                await fetchAndCachePromoVideo();
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

// इन-ऐप टैब स्विचिंग
window.switchAppTab = async (tabName) => {
    stopQRScanner();
    ['home', 'mystery', 'profile', 'pay'].forEach(t => {
        document.getElementById('tab-' + t).classList.add('hidden-screen');
        const link = document.getElementById('nav-' + t);
        if (link) link.classList.remove('active');
    });
    document.getElementById('nav-pay-circle').parentElement.classList.remove('active');

    document.getElementById('tab-' + tabName).classList.remove('hidden-screen');
    if (tabName === 'pay') {
        document.getElementById('nav-pay-circle').parentElement.classList.add('active');
    } else {
        document.getElementById('nav-' + tabName).classList.add('active');
    }

    if (tabName === 'mystery') await syncMysteryLimit();
    if (tabName === 'pay') window.openPaymentArea();
};

// रंगीन कस्टम अलर्ट
window.showCustomAlert = (title, msg, type) => {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = msg;
    const iconEl = document.getElementById('alertIcon');
    iconEl.innerText = type === 'success' ? '🎉' : '❌';
    iconEl.style.color = type === 'success' ? 'var(--success)' : 'var(--danger)';
    document.getElementById('customAlert').classList.remove('hidden-screen');
};
window.closeAlert = () => document.getElementById('customAlert').classList.add('hidden-screen');

// 🔒 एंटी-चीट चाबी प्रोटेक्शन (महीने में 1 बार लॉक चेकर)
async function checkKeyMonthLock(userMobile, key) {
    const snap = await getDoc(doc(db, "users", userMobile, "used_keys", key));
    if (snap.exists()) {
        const claimTime = snap.data().claimedAt;
        if (claimTime) {
            const diff = Math.abs(new Date() - new Date(claimTime));
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            if (days <= 30) return false; // इस्तेमाल हो चुकी है
        }
    }
    return true; // फ्रेश चाबी है
}

// =================== 🎁 [Step 1: बाहर से चाबी को सिर्फ नोट करना] ===================
// =================== 🎁 [Step 1: बाहर से चाबी को सिर्फ नोट करना] ===================
window.verifyKey = async () => {
    const key = document.getElementById('userKey').value.trim();
    if (key.length !== 5) return showCustomAlert("अमान्य ❌", "5 अंकों की सही चाबी डालें।", "error");

    try {
        // डेटाबेस में चाबी अस्तित्व की जांच
        const assetSnap = await getDoc(doc(db, "assets", key));
        if (!assetSnap.exists()) return showCustomAlert("गलत चाबी ❌", "यह चाबी मान्य नहीं है! कृपया वीडियो दोबारा ध्यान से देखें।", "error");

        const assetData = assetSnap.data();
        const winCoins = assetData.value || 100;

        // चाबी और कॉइन्स को तुरंत बैकएंड सेशन मेमोरी में सेव करें
        sessionStorage.setItem('temp_key', key);
        sessionStorage.setItem('temp_coins', winCoins);

        // [सुधार]: पुराने कंटेनर को पूरी तरह छुपाकर केवल मोबाइल नंबर वाला सुंदर बॉक्स खोलें
        document.getElementById('keySection').classList.add('hidden-screen');
        document.getElementById('rewardSection').classList.remove('hidden-screen');

    } catch (e) { showCustomAlert("Error", "सर्वर एरर आया है!", "error"); }
};

// =================== 📱 [Step 2: मोबाइल एंट्री और सरल स्मार्ट लॉगिन गेटवे] ===================
window.saveMobile = async () => {
    const inputMobile = document.getElementById('userMobile').value.trim();
    const savedKey = sessionStorage.getItem('temp_key');
    const savedCoins = Number(sessionStorage.getItem('temp_coins') || 0);

    if (inputMobile.length !== 10) return showCustomAlert("त्रुटि ❌", "10 अंकों का सही मोबाइल नंबर डालें!", "error");
    if (!savedKey) return showCustomAlert("त्रुटि ❌", "सत्र समाप्त! कृपया दोबारा चाबी दर्ज करें।", "error");

    try {
        const userRef = doc(db, "users", inputMobile);
        const userSnap = await getDoc(userRef);

        // 1. यदि यूजर बिल्कुल नया है -> खाता बनाएं + वीडियो कॉइन्स + 1000 वेलकम बोनस!
        if (!userSnap.exists()) {
            const finalCoins = savedCoins + 1000;
            
            await setDoc(userRef, { 
                mobile: inputMobile, 
                balance: finalCoins, 
                userName: "नया यूजर",
                regDate: new Date().toISOString() 
            });

            // चाबी इतिहास लॉक करें
            await setDoc(doc(db, "users", inputMobile, "used_keys", savedKey), { 
                key: savedKey, amount: savedCoins, claimedAt: new Date().toISOString() 
            });

            localStorage.setItem('userMobile', inputMobile);
            document.getElementById('winSound').play();
            showCustomAlert("Welcome Bonus! 🎉", `स्वागत है! नया अकाउंट बोनस +1000 और वीडियो के +${savedCoins} सिक्के आपके खाते में जोड़ दिए गए हैं।`, "success");
            setTimeout(() => location.reload(), 2500);
            return;
        }

        // 2. यदि यूजर पुराना है -> बैकएंड में चेक करें कि क्या यह चाबी वह पहले इस्तेमाल कर चुका है?
        const isKeyFresh = await checkKeyMonthLock(inputMobile, savedKey);

        if (isKeyFresh) {
            // पुराना यूजर + बिल्कुल नई चाबी -> पुराने बैलेंस में सिक्के जोड़ें
            const currentBal = userSnap.data().balance || 0;
            const finalCoins = currentBal + savedCoins;
            
            await setDoc(userRef, { balance: finalCoins }, { merge: true });
            await setDoc(doc(db, "users", inputMobile, "used_keys", savedKey), { 
                key: savedKey, amount: savedCoins, claimedAt: new Date().toISOString() 
            });

            localStorage.setItem('userMobile', inputMobile);
            document.getElementById('winSound').play();
            showCustomAlert("सफलता 🎉", `चाबी वेरिफाई हो गई! +${savedCoins} सिक्के आपके अकाउंट में जोड़ दिए गए हैं।`, "success");
        } else {
            // 🎯 [स्मार्ट लॉगिन]: पुराना यूजर + पहले उपयोग की जा चुकी चाबी -> कोई सिक्का नहीं जुड़ेगा, सीधा लॉगिन सफल!
            localStorage.setItem('userMobile', inputMobile);
            showCustomAlert("लॉगिन सफल 👋", "यह चाबी आप पहले क्लेम कर चुके हैं। आपका अकाउंट सफलतापूर्वक लॉगिन कर दिया गया है!", "success");
        }

        // सेशन मेमोरी साफ़ करें
        sessionStorage.removeItem('temp_key');
        sessionStorage.removeItem('temp_coins');
        setTimeout(() => location.reload(), 2500);

    } catch (e) { showCustomAlert("Error", "प्रोसेसिंग विफल!", "error"); }
};

// पुराना यूजर: डैशबोर्ड के अंदर से चाबी क्लेम करना
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
    } catch (e) { showCustomAlert("Error", "पेमेंट fail हुआ!", "error"); }
};

window.logout = () => {
    localStorage.removeItem('userMobile');
    sessionStorage.clear();
    location.reload();
};

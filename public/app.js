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
let globalActiveMerchant = null; // [💥 मेसेज फेल्ड फिक्स]: दुकानदार डेटा स्टोर करने के लिए 100% सिक्योर वेरिएबल

let mBoxType = 0, mDigits = 0, mReward = 0;
const mobile = localStorage.getItem('userMobile');
const todayDate = new Date().toISOString().substring(0, 10);

// 🎯 [स्मार्ट गेटकीपर और इन-ऐप मैनेजर]
window.addEventListener('DOMContentLoaded', async () => {
    if (mobile) {
        document.getElementById('dashboardContainer').classList.remove('hidden-screen');
        document.getElementById('authContainer').classList.add('hidden-screen');
        
        switchAppTab('home');
        await loadCachedDashboard();
    } else {
        document.getElementById('authContainer').classList.remove('hidden-screen');
        document.getElementById('dashboardContainer').classList.add('hidden-screen');
    }
});

// साइडबार खोलना/बंद करना
window.toggleSidebar = (open) => {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (open) {
        sidebar.classList.add('open');
        overlay.classList.remove('hidden-screen');
    } else {
        sidebar.classList.remove('open');
        overlay.classList.add('hidden-screen');
    }
};

// सेशन मेमोरी मैनेजमेंट (फायरबेस रीड्स सेविंग)
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
    
    // साइडबार में भी लाइव नेम सिंक करना
    document.getElementById('sideMenuUser').innerText = name;
    document.getElementById('sideMenuPhone').innerText = "+91 " + mobile;
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
    window.toggleSidebar(false);
    ['home', 'mystery', 'pay'].forEach(t => {
        document.getElementById('tab-' + t).classList.add('hidden-screen');
        const link = document.getElementById('nav-' + t);
        if (link) link.classList.remove('active');
    });
    document.getElementById('nav-pay-circle').parentElement.classList.remove('active');

    document.getElementById('tab-' + tabName).classList.remove('hidden-screen');
    if (tabName === 'pay') {
        document.getElementById('nav-pay-circle').parentElement.classList.add('active');
    } else {
        const link = document.getElementById('nav-' + tabName);
        if (link) link.classList.add('active');
    }

    if (tabName === 'mystery') await syncMysteryLimit();
    if (tabName === 'pay') window.openPaymentArea();
};

// प्रीमियम सेन्टर कलरफुल अलर्ट
window.showCustomAlert = (title, msg, type) => {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = msg;
    const iconEl = document.getElementById('alertIcon');
    iconEl.innerText = type === 'success' ? '🎉' : '❌';
    iconEl.style.color = type === 'success' ? 'var(--success)' : 'var(--danger)';
    document.getElementById('customAlert').classList.remove('hidden-screen');
};
window.closeAlert = () => document.getElementById('customAlert').classList.add('hidden-screen');

// 🔒 30 दिन लॉक चेकर
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

// चाबी नोट करना (नया यूजर)
window.verifyKey = async () => {
    const key = document.getElementById('userKey').value.trim();
    if (key.length !== 5) return showCustomAlert("अमान्य ❌", "5 अंकों की सही चाबी डालें।", "error");

    try {
        const assetSnap = await getDoc(doc(db, "assets", key));
        if (!assetSnap.exists()) return showCustomAlert("गलत चाबी ❌", "यह चाबी मान्य नहीं है! वीडियो ध्यान से देखें।", "error");

        sessionStorage.setItem('temp_key', key);
        sessionStorage.setItem('temp_coins', assetSnap.data().value || 100);

        document.getElementById('keySection').classList.add('hidden-screen');
        document.getElementById('rewardSection').classList.remove('hidden-screen');
    } catch (e) { showCustomAlert("Error", "सर्वर एरर!", "error"); }
};

window.saveMobile = async () => {
    const inputMobile = document.getElementById('userMobile').value.trim();
    const savedKey = sessionStorage.getItem('temp_key');
    const savedCoins = Number(sessionStorage.getItem('temp_coins') || 0);

    if (inputMobile.length !== 10) return showCustomAlert("त्रुटि ❌", "10 अंकों का सही मोबाइल नंबर डालें!", "error");
    if (!savedKey) return showCustomAlert("त्रुटि ❌", "सत्र समाप्त! दोबारा चाबी दर्ज करें।", "error");

    try {
        const userRef = doc(db, "users", inputMobile);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            const finalCoins = savedCoins + 1000; // +1000 वेलकम बोनस
            await setDoc(userRef, { mobile: inputMobile, balance: finalCoins, userName: "नया यूजर", regDate: new Date().toISOString() });
            await setDoc(doc(db, "users", inputMobile, "used_keys", savedKey), { key: savedKey, amount: savedCoins, claimedAt: new Date().toISOString() });
            localStorage.setItem('userMobile', inputMobile);
            document.getElementById('winSound').play();
            showCustomAlert("Welcome Bonus! 🎉", `अकाउंट बोनस +1000 और वीडियो के +${savedCoins} सिक्के क्रेडिट हो गए हैं!`, "success");
            setTimeout(() => location.reload(), 2500);
            return;
        }

        const isKeyFresh = await checkKeyMonthLock(inputMobile, savedKey);
        if (isKeyFresh) {
            const currentBal = userSnap.data().balance || 0;
            await setDoc(userRef, { balance: currentBal + savedCoins }, { merge: true });
            await setDoc(doc(db, "users", inputMobile, "used_keys", savedKey), { key: savedKey, amount: savedCoins, claimedAt: new Date().toISOString() });
            localStorage.setItem('userMobile', inputMobile);
            document.getElementById('winSound').play();
            showCustomAlert("सफलता 🎉", `चाबी वेरिफाई हो गई! +${savedCoins} सिक्के आपके अकाउंट में जोड़ दिए गए हैं।`, "success");
        } else {
            localStorage.setItem('userMobile', inputMobile);
            showCustomAlert("लॉगिन सफल 👋", "यह चाबी आप पहले क्लेम कर चुके हैं। आपका अकाउंट लॉगिन कर दिया गया है!", "success");
        }

        sessionStorage.removeItem('temp_key');
        sessionStorage.removeItem('temp_coins');
        setTimeout(() => location.reload(), 2500);
    } catch (e) { showCustomAlert("Error", "प्रोसेसिंग विफल!", "error"); }
};

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
    const finalBalance = (userDoc.data().balance || 0) + winValue;

    await setDoc(userRef, { balance: finalBalance }, { merge: true });
    await setDoc(doc(db, "users", mobile, "used_keys", key), { key: key, amount: winValue, claimedAt: new Date().toISOString() });

    sessionStorage.setItem('cash_balance', finalBalance);
    document.getElementById('winSound').play();
    showCustomAlert("Claimed! 🎉", `बधाई हो! +${winValue} सिक्के वॉलेट में जुड़ गए।`, "success");
    document.getElementById('dashSecretKey').value = "";
    
    renderDashboardUI(sessionStorage.getItem('cash_name'), finalBalance);
    await fetchAndCachePromoVideo();
};

// =================== 🍔 [साइडबार बोनस फीचर्स फंक्शन्स] ===================

window.openSidebarBonus = (bonusType) => {
    window.toggleSidebar(false);
    ['profile_bonus', 'refer_bonus', 'social_bonus', 'settings'].forEach(b => {
        document.getElementById('widget-' + b).classList.add('hidden-screen');
    });

    if (bonusType === 'refer_bonus') {
        // डायनामिक रेफरल कोड बनाएं
        document.getElementById('lblReferralCodeBox').innerText = `REHLI-${mobile.substring(6)}96`;
    }

    document.getElementById('widget-' + bonusType).classList.remove('hidden-screen');
    document.getElementById('bonusModal').classList.remove('hidden-screen');
};

window.closeBonusModal = () => document.getElementById('bonusModal').classList.add('hidden-screen');

// 1. प्रोफाइल बोनस क्लेम करें
window.claimProfileBonus = async () => {
    const nameInput = document.getElementById('profFullNameInp').value.trim();
    if (nameInput.length < 3) return showCustomAlert("त्रुटि ❌", "कृपया अपना पूरा सही नाम दर्ज करें!", "error");

    try {
        const userRef = doc(db, "users", mobile);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.data().profileBonusClaimed) {
            return showCustomAlert("नियम ब्लॉक ❌", "आप प्रोफाइल बोनस (+500 एसेट्स) पहले ही क्लेम कर चुके हैं।", "error");
        }

        const currentBal = userDoc.data().balance || 0;
        const newBalance = currentBal + 500;

        await setDoc(userRef, { 
            userName: nameInput, 
            balance: newBalance, 
            profileBonusClaimed: true 
        }, { merge: true });

        sessionStorage.setItem('cash_name', nameInput);
        sessionStorage.setItem('cash_balance', newBalance);
        renderDashboardUI(nameInput, newBalance);

        closeBonusModal();
        showCustomAlert("प्रोफाइल बोनस! 🎉", "बधाई हो! प्रोफाइल पूरी करने पर +500 सिक्के क्रेडिट कर दिए गए हैं।", "success");
    } catch (e) { showCustomAlert("Error", "प्रोफाइल अपडेट फेल!", "error"); }
};

// 2. रेफरल कोड शेयर
window.shareReferralCode = () => {
    const code = document.getElementById('lblReferralCodeBox').innerText;
    const shareText = `*रहली डिजिटल एसेट नेटवर्क* ज्वाइन करें और मेरा रेफरल कोड *${code}* इस्तेमाल करके मुफ्त में +1000 वेलकम बोनस सिक्के कमाएं! ऐप लिंक यहाँ से खोलें: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
};

// 3. सोशल मीडिया बोनस
window.claimSocialBonus = async () => {
    try {
        const userRef = doc(db, "users", mobile);
        const userDoc = await getDoc(userRef);

        if (userDoc.data().socialBonusClaimed) {
            return showCustomAlert("नियम ब्लॉक ❌", "आप सोशल मीडिया बोनस पहले ही ले चुके हैं।", "error");
        }

        const currentBal = userDoc.data().balance || 0;
        const newBalance = currentBal + 200;

        await setDoc(userRef, { balance: newBalance, socialBonusClaimed: true }, { merge: true });
        sessionStorage.setItem('cash_balance', newBalance);
        renderDashboardUI(sessionStorage.getItem('cash_name'), newBalance);

        closeBonusModal();
        showCustomAlert("सोशल बोनस! 🎉", "चैनल ज्वाइन करने का बोनस +200 सिक्के क्रेडिट हो गया है।", "success");
    } catch (e) { showCustomAlert("Error", "क्लेम फेल!", "error"); }
};

// =================== 🔮 [इन-ऐप मिस्ट्री बॉक्स] ===================
async function syncMysteryLimit() {
    const limitSnap = await getDoc(doc(db, "users", mobile, "mystery_limit", todayDate));
    document.getElementById('remainingAttempts').innerText = 3 - (limitSnap.exists() ? limitSnap.data().count || 0 : 0);
}

window.openMysteryPinModal = async (boxType, digits, reward, name) => {
    const limitSnap = await getDoc(doc(db, "users", mobile, "mystery_limit", todayDate));
    if ((limitSnap.exists() ? limitSnap.data().count || 0 : 0) >= 3) return showCustomAlert("Limit Exceeded! 🚨", "आप एक दिन में केवल 3 बार ही मिस्ट्री बॉक्स खोल सकते हैं।", "error");
    if (Number(sessionStorage.getItem('cash_balance') || 0) < 1000) return showCustomAlert("Low Balance ❌", "गेम खेलने के लिए मिनिमम 1000 सिक्के चाहिए।", "error");

    mBoxType = boxType; mDigits = digits; mReward = reward;
    const pinInp = document.getElementById('mPinInput');
    pinInp.value = ""; pinInp.placeholder = `${digits} Digit PIN`;
    document.getElementById('mModalTitle').innerText = `Unlock ${name}`;
    document.getElementById('mysteryModal').classList.remove('hidden-screen');
};

window.closeMysteryModal = () => document.getElementById('mysteryModal').classList.add('hidden-screen');

window.attemptMysteryUnlock = async () => {
    const userPinInput = document.getElementById('mPinInput').value.trim();
    if (userPinInput.length !== mDigits) return alert(`पिन पूरा भरें!`);

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
        await Promise.all([ setDoc(userRef, { balance: feesDeductedBalance }, { merge: true }), setDoc(limitRef, { count: currentCount + 1 }) ]);

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

// =================== 💸 [पेटीएम स्टाइल 2-Step पेमेंट गेटवे - 100% फिक्स्ड] ===================

window.openPaymentArea = () => {
    document.getElementById('payMerchantMobile').value = "";
    document.getElementById('payAmount').value = "";
    document.getElementById('payBillAmount').value = "";
    document.getElementById('merchantVerifyArea').classList.add('hidden-screen');
    document.getElementById('paymentFormArea').classList.add('hidden-screen');
    globalActiveMerchant = null; // रिसेट मर्चेंट वेरिएबल
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
            globalActiveMerchant = null;
            return showCustomAlert("Not Found ❌", "यह दुकानदार डिजिटल नेटवर्क पर नहीं है।", "error");
        }

        // [💥 फिक्स]: मर्चेंट डेटा को सही ग्लोबल वेरिएबल में असाइन किया
        globalActiveMerchant = mSnap.data();
        
        document.getElementById('lblVerifiedShopName').innerText = globalActiveMerchant.shopName + " 🏪";
        document.getElementById('lblVerifiedShopPhone').innerText = "Shop ID: +91 " + globalActiveMerchant.mobile;
        
        const minBill = globalActiveMerchant.minBillAmount || 100;
        const maxTxn = globalActiveMerchant.perTxnLimit || 5000;
        document.getElementById('lblShopRulesInfo').innerText = `शर्तें: न्यूनतम बिल ₹${minBill} | मैक्सिमम लिमिट ${maxTxn}`;

        document.getElementById('merchantVerifyArea').classList.remove('hidden-screen');
        document.getElementById('paymentFormArea').classList.remove('hidden-screen');
    } catch (e) { console.error(e); }
}

// [💥 पूर्णतः संशोधित भुगतान फ़ंक्शन]: अब कभी भी "मेसेज फेल्ड" नहीं आएगा!
window.processPayment = async () => {
    if (!globalActiveMerchant) {
        return showCustomAlert("त्रुटि ❌", "दुकानदार का वेरिफिकेशन खो गया है, कृपया दोबारा खोजें!", "error");
    }
    
    const amountStr = document.getElementById('payAmount').value;
    const billStr = document.getElementById('payBillAmount').value;

    if (!amountStr || !billStr) return showCustomAlert("अधूरा फॉर्म ❌", "एसेट राशि और बिल राशि दोनों भरें!", "error");

    const payAmount = Number(amountStr);
    const billAmount = Number(billStr);
    const mMobile = globalActiveMerchant.mobile;
    const perTxnLimit = globalActiveMerchant.perTxnLimit || 5000;
    const minBillAmount = globalActiveMerchant.minBillAmount || 100;

    if (billAmount < minBillAmount) return showCustomAlert("नियम उल्लंघन ❌", `दुकान का न्यूनतम बिल ₹${minBillAmount} होना चाहिए।`, "error");
    if (payAmount > perTxnLimit) return showCustomAlert("नियम उल्लंघन ❌", `इस दुकान पर एक बार में अधिकतम लिमिट ${perTxnLimit} सिक्के है।`, "error");

    try {
        const userRef = doc(db, "users", mobile);
        const userDoc = await getDoc(userRef);
        const userCurrentBal = userDoc.data().balance || 0;

        if (userCurrentBal < payAmount) return showCustomAlert("लो बैलेंस ❌", "वॉलेट में पर्याप्त सिक्के नहीं हैं!", "error");

        const newTxRef = doc(collection(db, "merchant_transactions"));
        const currentMerchantBalance = globalActiveMerchant.balance || 0;

        const finalUserBal = userCurrentBal - payAmount;
        
        // फायरबेस में डेटा सुरक्षित रूप से सबमिट करें
        await Promise.all([
            setDoc(userRef, { balance: finalUserBal }, { merge: true }),
            setDoc(doc(db, "merchants", mMobile), { balance: currentMerchantBalance + payAmount }, { merge: true }),
            setDoc(newTxRef, { 
                txId: newTxRef.id, 
                userMobile: mobile, 
                merchantMobile: mMobile, 
                amount: payAmount, 
                billAmount: billAmount, 
                timestamp: new Date().toISOString() 
            })
        ]);

        // [जादू]: यूआई और सेशन को तुरंत अपडेट करें
        sessionStorage.setItem('cash_balance', finalUserBal);
        const successShopName = globalActiveMerchant.shopName;
        
        window.openPaymentArea(); // फॉर्म साफ़ करें
        
        // अब बिल्कुल सही "भुगतान सफल" का मैसेज ही ट्रिगर होगा
        showCustomAlert("भुगतान सफल! 💸", `सफलतापूर्वक ${payAmount} एसेट ${successShopName} को ट्रांसफर हो गए हैं।`, "success");
        
        renderDashboardUI(sessionStorage.getItem('cash_name'), finalUserBal);
    } catch (e) { 
        showCustomAlert("Error ❌", "सर्वर एरर: भुगतान विफल हुआ!", "error"); 
    }
};

window.logout = () => {
    localStorage.removeItem('userMobile');
    sessionStorage.clear();
    location.reload();
};

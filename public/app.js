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
let globalActiveMerchant = null; 

let mBoxType = 0, mDigits = 0, mReward = 0;
const mobile = localStorage.getItem('userMobile');
const todayDate = new Date().toISOString().substring(0, 10);

// 🎯 [स्मार्ट गेटकीपर]
window.addEventListener('DOMContentLoaded', async () => {
    if (mobile) {
        document.getElementById('dashboardContainer').classList.remove('hidden-screen');
        document.getElementById('authContainer').classList.add('hidden-screen');
        window.switchAppTab('home');
        await loadCachedDashboard();
    } else {
        document.getElementById('authContainer').classList.remove('hidden-screen');
        document.getElementById('dashboardContainer').classList.add('hidden-screen');
        
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        if (refCode) {
            const refInput = document.getElementById('userReferralInput');
            if (refInput) {
                refInput.value = refCode.trim().toUpperCase();
                refInput.style.background = "#d4edda"; 
            }
        }
    }
});

window.toggleSidebar = (open) => {
    document.getElementById('appSidebar').classList.toggle('open', open);
    document.getElementById('sidebarOverlay').classList.toggle('hidden-screen', !open);
};

// 🔒 सेशन मेमोरी 
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
        } catch (e) { console.error("Cache Error:", e); }
    }
}

function renderDashboardUI(name, balance) {
    document.getElementById('dashUserName').innerText = `नमस्ते, ${name}! 👋`;
    document.getElementById('dashUserPhone').innerText = "+91 " + mobile;
    document.getElementById('dashBalance').innerText = balance;
    document.getElementById('sideMenuUser').innerText = name;
    document.getElementById('sideMenuPhone').innerText = "+91 " + mobile;
}

function renderCachedPromoVideo() {
    const pTitle = localStorage.getItem('promo_title');
    const pLink = localStorage.getItem('promo_link');
    if (pTitle && pLink) {
        const titleEl = document.getElementById('lblPromoTitle');
        const linkEl = document.getElementById('btnPromoLink');
        if (titleEl) titleEl.innerText = pTitle;
        if (linkEl) linkEl.href = pLink;
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
    } catch (e) { console.error("Video Error:", e); }
}

// --- 📱 स्मार्ट टैब स्विचर ---
window.switchAppTab = async (tabName) => {
    window.toggleSidebar(false);
    document.querySelectorAll('.app-tab-content').forEach(t => t.classList.add('hidden-screen'));
    const targetTab = document.getElementById('tab-' + tabName);
    if (targetTab) targetTab.classList.remove('hidden-screen');
    
    if (tabName === 'wallet') updateWalletSheet();
    if (tabName === 'profile') loadProfileScreen();
};

// --- 👤 प्रोफाइल लोड करने का लॉजिक ---
async function loadProfileScreen() {
    const userSnap = await getDoc(doc(db, "users", mobile));
    const uData = userSnap.data();

    const formArea = document.getElementById('profileFormArea');
    const statusArea = document.getElementById('profileStatusArea');

    if (!uData.profileCompleted) {
        formArea.classList.remove('hidden-screen');
        statusArea.classList.add('hidden-screen');
    } else {
        formArea.classList.add('hidden-screen');
        statusArea.classList.remove('hidden-screen');
        document.getElementById('stName').innerText = uData.userName;
        document.getElementById('stDOB').innerText = uData.dob || "Not Set";
        document.getElementById('stWhatsapp').innerText = uData.whatsapp || mobile;
    }
    document.getElementById('pinPanelArea').classList.add('hidden-screen');
}

// --- 🔒 प्रोफाइल सेव (+500 बोनस) ---
window.saveFullProfile = async () => {
    const name = document.getElementById('pName').value.trim();
    const dob = document.getElementById('pDOB').value;
    const pin = document.getElementById('pPin').value;
    const conf = document.getElementById('pPinConfirm').value;

    if (!name || !dob || pin.length !== 4) return window.showCustomAlert("त्रुटि", "सभी जानकारी भरें!");
    if (pin !== conf) return window.showCustomAlert("Error", "पिन मैच नहीं हुआ!");

    try {
        const userRef = doc(db, "users", mobile);
        const snap = await getDoc(userRef);
        let finalBal = (snap.data().balance || 0);
        
        if (!snap.data().profileCompleted) finalBal += 500;

        await setDoc(userRef, {
            userName: name, dob: dob, securityPin: pin, whatsapp: mobile,
            balance: finalBal, profileCompleted: true
        }, { merge: true });

        sessionStorage.setItem('cash_name', name);
        sessionStorage.setItem('cash_balance', finalBal);
        renderDashboardUI(name, finalBal);
        window.showCustomAlert("सफल!", "प्रोफाइल सुरक्षित हुई और +500 सिक्के मिले!", "success");
        loadProfileScreen();
    } catch (e) { console.error(e); }
};

// --- 💰 वॉलेट कैलकुलेटर ---
async function updateWalletSheet() {
    const userSnap = await getDoc(doc(db, "users", mobile));
    const txSnap = await getDocs(query(collection(db, "merchant_transactions"), where("userMobile", "==", mobile)));
    
    let spent = 0;
    txSnap.forEach(d => spent += (d.data().amount || 0));
    const bal = userSnap.data().balance || 0;

    document.getElementById('wTotalEarned').innerText = bal + spent;
    document.getElementById('wTotalSpent').innerText = spent;
    document.getElementById('wSpentValue').innerText = "₹ " + (spent / 20).toFixed(2);
}

// --- 🔑 चाबी वेरिफिकेशन ---
window.verifyKey = async () => {
    const key = document.getElementById('userKey').value.trim();
    if (key.length !== 5) return window.showCustomAlert("अमान्य ❌", "5 अंकों की सही चाबी डालें।", "error");

    try {
        const assetSnap = await getDoc(doc(db, "assets", key));
        if (!assetSnap.exists()) return window.showCustomAlert("गलत चाबी ❌", "चाबी मान्य नहीं है!", "error");

        sessionStorage.setItem('temp_key', key);
        sessionStorage.setItem('temp_coins', assetSnap.data().value || 100);

        document.getElementById('keySection').classList.add('hidden-screen');
        document.getElementById('rewardSection').classList.remove('hidden-screen');
    } catch (e) { window.showCustomAlert("Error", "सर्वर एरर!", "error"); }
};

// =================== 📱 [खाता निर्माण + लॉगिन] ===================
window.saveMobile = async () => {
    const inputMobile = document.getElementById('userMobile').value.trim();
    const refCodeUsed = document.getElementById('userReferralInput').value.trim();
    const savedKey = sessionStorage.getItem('temp_key');
    const savedCoins = Number(sessionStorage.getItem('temp_coins') || 0);

    if (inputMobile.length !== 10) return window.showCustomAlert("त्रुटि ❌", "10 अंकों का मोबाइल नंबर डालें!", "error");
    if (!savedKey) return window.showCustomAlert("त्रुटि ❌", "सत्र समाप्त! दोबारा चाबी दर्ज करें।", "error");

    try {
        const userRef = doc(db, "users", inputMobile);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            let welcomeCoins = savedCoins + 1000;
            await setDoc(userRef, { 
                mobile: inputMobile, balance: welcomeCoins, userName: "नया यूजर", referredBy: refCodeUsed || "Direct", regDate: new Date().toISOString() 
            });
            await setDoc(doc(db, "users", inputMobile, "used_keys", savedKey), { key: savedKey, amount: savedCoins, claimedAt: new Date().toISOString() });
            localStorage.setItem('userMobile', inputMobile);
            document.getElementById('winSound').play();
            window.showCustomAlert("अकाउंट बन गया!", `स्वागत बोनस +1000 और वीडियो के +${savedCoins} सिक्के मिले!`, "success");
            setTimeout(() => location.reload(), 2500);
            return;
        }

        const isKeyFresh = await checkKeyMonthLock(inputMobile, savedKey);
        if (isKeyFresh) {
            const currentBal = userSnap.data().balance || 0;
            await setDoc(userRef, { balance: currentBal + savedCoins }, { merge: true });
            await setDoc(doc(db, "users", inputMobile, "used_keys", savedKey), { key: savedKey, amount: savedCoins, claimedAt: new Date().toISOString() });
            window.showCustomAlert("सफलता 🎉", `चाबी वेरिफाई हुई! +${savedCoins} सिक्के क्रेडिट हुए।`, "success");
        } else {
            window.showCustomAlert("लॉगिन सफल 👋", "अकाउंट लॉगिन कर दिया गया है!", "success");
        }
        localStorage.setItem('userMobile', inputMobile);
        setTimeout(() => location.reload(), 2000);
    } catch (e) { window.showCustomAlert("Error", "प्रोसेसिंग विफल!", "error"); }
};

// =================== 💸 [पेमेंट गेटवे] ===================
window.processPayment = async () => {
    if (!globalActiveMerchant) return;
    
    const payAmount = Number(document.getElementById('payAmount').value);
    const billAmount = Number(document.getElementById('payBillAmount').value);
    const inputPin = document.getElementById('paySecurityPin').value.trim();

    if (!payAmount || !billAmount || inputPin.length !== 4) {
        return window.showCustomAlert("अधूरा फॉर्म ❌", "पूरी जानकारी और 4 अंकों का पिन डालें!", "error");
    }

    try {
        const userRef = doc(db, "users", mobile);
        const userDoc = await getDoc(userRef);
        const uData = userDoc.data();

        if (uData.securityPin !== inputPin) return window.showCustomAlert("गलत पिन ❌", "पिन गलत है!", "error");
        if ((uData.balance || 0) < payAmount) return window.showCustomAlert("लो बैलेंस ❌", "सिक्के पर्याप्त नहीं हैं!", "error");

        const newTxRef = doc(collection(db, "merchant_transactions"));
        const finalUserBal = (uData.balance || 0) - payAmount;
        const merchantRef = doc(db, "merchants", globalActiveMerchant.mobile);
        const currentMerchantBal = (globalActiveMerchant.balance || 0);

        await Promise.all([
            setDoc(userRef, { balance: finalUserBal }, { merge: true }),
            setDoc(merchantRef, { balance: currentMerchantBal + payAmount }, { merge: true }),
            setDoc(newTxRef, { txId: newTxRef.id, userMobile: mobile, merchantMobile: globalActiveMerchant.mobile, amount: payAmount, billAmount: billAmount, timestamp: new Date().toISOString() })
        ]);

        sessionStorage.setItem('cash_balance', finalUserBal);
        window.openPaymentArea();
        window.showCustomAlert("भुगतान सफल!", `+${payAmount} ट्रांसफर हो गए।`, "success");
        renderDashboardUI(uData.userName, finalUserBal);
    } catch (e) { window.showCustomAlert("Error", "भुगतान विफल!", "error"); }
};

// बाकी के छोटे फंक्शंस (Alert, Logout, SideBar)
window.showCustomAlert = (title, msg, type) => {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = msg;
    const iconEl = document.getElementById('alertIcon');
    iconEl.innerText = type === 'success' ? '🎉' : '❌';
    document.getElementById('customAlert').classList.remove('hidden-screen');
};
window.closeAlert = () => document.getElementById('customAlert').classList.add('hidden-screen');

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

window.logout = () => {
    localStorage.removeItem('userMobile');
    sessionStorage.clear();
    location.reload();
};

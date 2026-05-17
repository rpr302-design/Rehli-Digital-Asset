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

// 🎯 [स्मार्ट गेटकीपर और यूआरएल पैरामीटर डिटेक्टर]
window.addEventListener('DOMContentLoaded', async () => {
    if (mobile) {
        document.getElementById('dashboardContainer').classList.remove('hidden-screen');
        document.getElementById('authContainer').classList.add('hidden-screen');
        switchAppTab('home');
        await loadCachedDashboard();
    } else {
        document.getElementById('authContainer').classList.remove('hidden-screen');
        document.getElementById('dashboardContainer').classList.add('hidden-screen');
        
        // 🔗 [जादू]: यूआरएल से ऑटोमैटिक रेफरल कोड ढूंढना (उदा. index.html?ref=REHLI1234)
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        if (refCode) {
            const refInput = document.getElementById('userReferralInput');
            refInput.value = refCode.trim().toUpperCase();
            refInput.style.background = "#2ecc71"; // रेफरल मिलने पर ग्रीन सिग्नल
        }
    }
});

window.toggleSidebar = (open) => {
    document.getElementById('appSidebar').classList.toggle('open', open);
    document.getElementById('sidebarOverlay').classList.toggle('hidden-screen', !open);
};

// 🔒 सेशन मेमोरी (Reads कंट्रोलर)
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

// --- 📱 स्मार्ट टैब स्विचर ---
window.switchAppTab = async (tabName) => {
    window.toggleSidebar(false);
    document.querySelectorAll('.app-tab-content').forEach(t => t.classList.add('hidden-screen'));
    document.getElementById('tab-' + tabName).classList.remove('hidden-screen');
    
    if (tabName === 'wallet') updateWalletSheet();
    if (tabName === 'profile') loadProfileScreen();
};

// --- 👤 प्रोफाइल लोड करने का लॉजिक ---
async function loadProfileScreen() {
    const userSnap = await getDoc(doc(db, "users", mobile));
    const uData = userSnap.data();

    if (!uData.profileCompleted) {
        document.getElementById('profileFormArea').classList.remove('hidden-screen');
        document.getElementById('profileStatusArea').classList.add('hidden-screen');
    } else {
        document.getElementById('profileFormArea').classList.add('hidden-screen');
        document.getElementById('profileStatusArea').classList.remove('hidden-screen');
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

    if (!name || !dob || pin.length !== 4) return showCustomAlert("त्रुटि", "सभी जानकारी भरें!");
    if (pin !== conf) return showCustomAlert("Error", "पिन मैच नहीं हुआ!");

    const userRef = doc(db, "users", mobile);
    const snap = await getDoc(userRef);
    let finalBal = (snap.data().balance || 0) + 500;

    await setDoc(userRef, {
        userName: name, dob: dob, securityPin: pin, whatsapp: mobile,
        balance: finalBal, profileCompleted: true
    }, { merge: true });

    showCustomAlert("सफल!", "प्रोफाइल सुरक्षित हुई और +500 सिक्के मिले!", "success");
    loadProfileScreen();
};

// --- 🔑 पिन मैनेजमेंट (Reset/Recovery) ---
let currentPinTask = "";
window.showPinPanel = (task) => {
    currentPinTask = task;
    document.getElementById('profileStatusArea').classList.add('hidden-screen');
    document.getElementById('pinPanelArea').classList.remove('hidden-screen');
    
    if (task === 'forgot') {
        document.getElementById('pinPanelTitle').innerText = "पिन रिकवरी";
        document.getElementById('recoveryInput1').placeholder = "अपना नाम भरें";
        document.getElementById('recoveryInput2').classList.remove('hidden-screen');
    } else {
        document.getElementById('pinPanelTitle').innerText = "पिन बदलें";
        document.getElementById('recoveryInput1').placeholder = "पुराना पिन डालें";
        document.getElementById('recoveryInput2').classList.add('hidden-screen');
    }
};

window.executePinUpdate = async () => {
    const val1 = document.getElementById('recoveryInput1').value;
    const val2 = document.getElementById('recoveryInput2').value; // DOB
    const newP = document.getElementById('newPinInput').value;

    const userRef = doc(db, "users", mobile);
    const snap = await getDoc(userRef);
    const data = snap.data();

    if (currentPinTask === 'reset') {
        if (val1 === data.securityPin) {
            await setDoc(userRef, { securityPin: newP }, { merge: true });
            showCustomAlert("सफल", "पिन अपडेट हो गया!", "success");
            loadProfileScreen();
        } else { showCustomAlert("Error", "पुराना पिन गलत है!"); }
    } else {
        if (val1 === data.userName && val2 === data.dob) {
            await setDoc(userRef, { securityPin: newP }, { merge: true });
            showCustomAlert("सफल", "नया पिन सेट हो गया!", "success");
            loadProfileScreen();
        } else { showCustomAlert("Error", "नाम या जन्मतिथि गलत है!"); }
    }
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

// --- 🔗 रेफरल शेयर लिंक जनरेटर ---
window.shareReferralCode = () => {
    const code = "REHLI" + mobile.substring(6);
    const link = window.location.origin + window.location.pathname + "?ref=" + code;
    const text = `*रहली डिजिटल एसेट* ज्वाइन करें और पाएं +1000 फ्री सिक्के!\nलिंक पर क्लिक करें, कोड अपने आप भर जाएगा: ${link}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
};

window.showCustomAlert = (title, msg, type) => {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = msg;
    const iconEl = document.getElementById('alertIcon');
    iconEl.innerText = type === 'success' ? '🎉' : '❌';
    iconEl.style.color = type === 'success' ? 'var(--success)' : 'var(--danger)';
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

window.verifyKey = async () => {
    const key = document.getElementById('userKey').value.trim();
    if (key.length !== 5) return showCustomAlert("अमान्य ❌", "5 अंकों की सही चाबी डालें।", "error");

    try {
        const assetSnap = await getDoc(doc(db, "assets", key));
        if (!assetSnap.exists()) return showCustomAlert("गलत चाबी ❌", "यह चाबी मान्य नहीं है! वीडियो दोबारा देखें।", "error");

        sessionStorage.setItem('temp_key', key);
        sessionStorage.setItem('temp_coins', assetSnap.data().value || 100);

        document.getElementById('keySection').classList.add('hidden-screen');
        document.getElementById('rewardSection').classList.remove('hidden-screen');
    } catch (e) { showCustomAlert("Error", "सर्वर एरर!", "error"); }
};
// --- 👤 Profile & Pin Management ---

async function loadProfileStatus() {
    try {
        const userSnap = await getDoc(doc(db, "users", mobile));
        const data = userSnap.data();
        if (!data.profileCompleted) {
            document.getElementById('profileForm').classList.remove('hidden-screen');
            document.getElementById('profileStatus').classList.add('hidden-screen');
        } else {
            document.getElementById('profileForm').classList.add('hidden-screen');
            document.getElementById('profileStatus').classList.remove('hidden-screen');
            document.getElementById('stName').innerText = data.userName;
        }
    } catch (e) { console.error(e); }
}

window.submitProfile = async () => {
    const name = document.getElementById('profName').value.trim();
    const dob = document.getElementById('profDOB').value;
    const pin = document.getElementById('profPin').value.trim();
    if (!name || !dob || pin.length !== 4) return window.showCustomAlert("त्रुटि", "सभी जानकारी और 4 अंकों का पिन भरें!");

    try {
        const userRef = doc(db, "users", mobile);
        const snap = await getDoc(userRef);
        let newBal = snap.data().balance || 0;
        if(!snap.data().profileCompleted) newBal += 500;

        await setDoc(userRef, { userName: name, dob: dob, securityPin: pin, balance: newBal, profileCompleted: true }, { merge: true });
        window.showCustomAlert("सफल!", "प्रोफाईल लॉक हो गई और +500 रिवॉर्ड मिला!", "success");
        await loadProfileStatus();
    } catch(e) { console.error(e); }
};
// =================== 📱 [खाता निर्माण + ऑटो रेफरल नियम] ===================
window.saveMobile = async () => {
    const inputMobile = document.getElementById('userMobile').value.trim();
    const refCodeUsed = document.getElementById('userReferralInput').value.trim();
    const savedKey = sessionStorage.getItem('temp_key');
    const savedCoins = Number(sessionStorage.getItem('temp_coins') || 0);

    if (inputMobile.length !== 10) return showCustomAlert("त्रुटि ❌", "10 अंकों का सही मोबाइल नंबर डालें!", "error");
    if (!savedKey) return showCustomAlert("त्रुटि ❌", "सत्र समाप्त! दोबारा चाबी दर्ज करें।", "error");

    try {
        const userRef = doc(db, "users", inputMobile);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // नया खाता निर्माण गेटवे + 1000 वेलकम बोनस
            let welcomeCoins = savedCoins + 1000;
            
            await setDoc(userRef, { 
                mobile: inputMobile, 
                balance: welcomeCoins, 
                userName: "नया यूजर", 
                referredBy: refCodeUsed || "Direct",
                regDate: new Date().toISOString() 
            });

            await setDoc(doc(db, "users", inputMobile, "used_keys", savedKey), { key: savedKey, amount: savedCoins, claimedAt: new Date().toISOString() });
            localStorage.setItem('userMobile', inputMobile);
            document.getElementById('winSound').play();
            showCustomAlert("अकाउंट बन गया! 🎉", `स्वागत बोनस +1000 और वीडियो के +${savedCoins} सिक्के क्रेडिट हो गए हैं!`, "success");
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
            showCustomAlert("लॉगिन सफल 👋", "अकाउंट सफलतापूर्वक लॉगिन कर दिया गया है!", "success");
        }

        sessionStorage.removeItem('temp_key');
        sessionStorage.removeItem('temp_coins');
        setTimeout(() => location.reload(), 2000);
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

// =================== 🍔 [साइडबार मॉड्यूल्स और 2-Step पिन सेटअप] ===================

window.openSidebarBonus = async (bonusType) => {
    window.toggleSidebar(false);
    ['profile_tab', 'refer_tab', 'social_tab', 'settings_tab'].forEach(b => {
        document.getElementById('widget-' + b).classList.add('hidden-screen');
    });

    if (bonusType === 'profile_tab') {
        document.getElementById('profUserMobileLocked').value = "+91 " + mobile;
        try {
            const userSnap = await getDoc(doc(db, "users", mobile));
            if (userSnap.exists()) {
                const uData = userSnap.data();
                if (uData.userName && uData.userName !== "नया यूजर") document.getElementById('profFullNameInp').value = uData.userName;
                if (uData.whatsapp) document.getElementById('profWhatsappInp').value = uData.whatsapp;
            }
        } catch (e) {}
    }

    if (bonusType === 'refer_tab') {
        document.getElementById('lblReferralCodeBox').innerText = `REHLI${mobile.substring(6)}`;
    }

    document.getElementById('widget-' + bonusType).classList.remove('hidden-screen');
    document.getElementById('bonusModal').classList.remove('hidden-screen');
};

window.closeBonusModal = () => document.getElementById('bonusModal').classList.add('hidden-screen');

// प्रोफाइल सुरक्षा और 2-Step पिन मैचिंग लॉक
window.claimProfileBonus = async () => {
    const fullName = document.getElementById('profFullNameInp').value.trim();
    const whatsapp = document.getElementById('profWhatsappInp').value.trim();
    const pin1 = document.getElementById('profSecurityPinInp').value.trim();
    const pin2 = document.getElementById('profSecurityPinConfirmInp').value.trim();

    if (!fullName || !whatsapp || pin1.length !== 4 || pin2.length !== 4) {
        return showCustomAlert("त्रुटि ❌", "कृपया सभी विवरण और 4 अंकों का पिन पूरा भरें!", "error");
    }

    // 🔒 पिन रिएंटर वेरिफिकेशन
    if (pin1 !== pin2) {
        return showCustomAlert("पिन मिसमैच ❌", "दोनों बॉक्स में डाला गया सिक्योरिटी पिन आपस में मैच नहीं खा रहा है!", "error");
    }

    try {
        const userRef = doc(db, "users", mobile);
        const userDoc = await getDoc(userRef);
        let currentBal = userDoc.data().balance || 0;
        let bonusAdded = false;

        if (!userDoc.data().profileBonusClaimed) {
            currentBal += 500;
            bonusAdded = true;
        }

        await setDoc(userRef, { 
            userName: fullName, whatsapp: whatsapp, securityPin: pin1, 
            balance: currentBal, profileBonusClaimed: true 
        }, { merge: true });

        sessionStorage.setItem('cash_name', fullName);
        sessionStorage.setItem('cash_balance', currentBal);
        renderDashboardUI(fullName, currentBal);
        closeBonusModal();

        if (bonusAdded) showCustomAlert("सुरक्षा लॉक एक्टिव! 🔒", "प्रोफाइल पूरी हो गई है और +500 एसेट्स वॉलेट में सुरक्षित ट्रांसफर कर दिए गए हैं।", "success");
        else showCustomAlert("विवरण अपडेट सफल! ✅", "आपकी सुरक्षा सेटिंग्स अपडेट कर दी गई हैं।", "success");
    } catch (e) { showCustomAlert("Error", "अपडेट फेल!", "error"); }
};

// रेफरल व्हाट्सएप इनवाइट लिंक जनरेटर (ऑटो-डिटेक्शन के साथ)
window.shareReferralCode = () => {
    const code = document.getElementById('lblReferralCodeBox').innerText;
    // [स्मार्ट]: लिंक के अंत में ?ref=CODE जोड़ा गया है
    const myAppUrl = window.location.href.split('?')[0]; 
    const shareText = `*रहली डिजिटल एसेट नेटवर्क* 🏪\n\nइस लिंक पर क्लिक करते ही मेरा रेफरल कोड अपने आप अप्लाई हो जाएगा। सीधे अपना खाता खोलें और मुफ्त में *+1000 सिक्के* वेलकम बोनस पाएं!\n\n👉 इनवाइट लिंक: ${myAppUrl}?ref=${code}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
};

// 📱 सोशल मीडिया दावा (One-Time Claim Logic)
window.claimMediaBonus = async (platformKey, coins, linkToOpen) => {
    window.open(linkToOpen, '_blank'); // प्लेटफॉर्म लिंक खोलें
    
    try {
        const userRef = doc(db, "users", mobile);
        const userDoc = await getDoc(userRef);
        const taskField = `task_${platformKey}_claimed`;

        if (userDoc.data()[taskField]) {
            return showCustomAlert("पहले से क्लेम है ❌", "आप यह सोशल मीडिया रिवॉर्ड पहले ही ले चुके हैं।", "error");
        }

        const currentBal = userDoc.data().balance || 0;
        const newBalance = currentBal + coins;

        await setDoc(userRef, { [taskField]: true, balance: newBalance }, { merge: true });
        sessionStorage.setItem('cash_balance', newBalance);
        renderDashboardUI(sessionStorage.getItem('cash_name'), newBalance);
        
        showCustomAlert("टास्क रिवॉर्ड! 🎉", `फॉलो करने के लिए +${coins} सिक्के क्रेडिट हो गए हैं!`, "success");
    } catch (e) { showCustomAlert("Error", "रिवॉर्ड क्लेम फेल!", "error"); }
};

// =================== 🔮 [इन-ऐप मिस्ट्री बॉक्स] ===================
async function syncMysteryLimit() {
    const limitSnap = await getDoc(doc(db, "users", mobile, "mystery_limit", todayDate));
    document.getElementById('remainingAttempts').innerText = 3 - (limitSnap.exists() ? limitSnap.data().count || 0 : 0);
}

window.openMysteryPinModal = async (boxType, digits, reward, name) => {
    const limitSnap = await getDoc(doc(db, "users", mobile, "mystery_limit", todayDate));
    if ((limitSnap.exists() ? limitSnap.data().count || 0 : 0) >= 3) return showCustomAlert("Limit Exceeded! 🚨", "दैनिक लिमिट समाप्त!", "error");
    if (Number(sessionStorage.getItem('cash_balance') || 0) < 1000) return showCustomAlert("Low Balance ❌", "मिनिमम 1000 सिक्के चाहिए।", "error");

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

// =================== 💸 [पेटीएम स्टाइल 2-Step पेमेंट गेटवे + पिन लॉक अनिवार्य] ===================

window.openPaymentArea = () => {
    document.getElementById('payMerchantMobile').value = "";
    document.getElementById('payAmount').value = "";
    document.getElementById('payBillAmount').value = "";
    document.getElementById('paySecurityPin').value = "";
    document.getElementById('merchantVerifyArea').classList.add('hidden-screen');
    document.getElementById('paymentFormArea').classList.add('hidden-screen');
    globalActiveMerchant = null;
};

window.startQRScanner = () => {
    document.getElementById('qrReaderContainer').classList.remove('hidden-screen');
    document.getElementById('btnStartScan').classList.add('hidden-screen');
    html5QrcodeScanner = new Html5Qrcode("qrReader");
    html5QrcodeScanner.start({ facingMode: "environment" }, { fps: 15, qrbox: { width: 220, height: 220 } },
        async (qrText) => {
            if (qrText.includes("REHLI-PAY:")) {
                const merchantNum = qrText.split(":")[1].trim();
                document.getElementById('payMerchantMobile').value = merchantNum;
                stopQRScanner();
                await verifyAndFetchMerchant(merchantNum);
            }
        }, (err) => {}
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
            return showCustomAlert("Not Found ❌", "यह दुकानदार नेटवर्क पर नहीं है।", "error");
        }
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

// 🔒 [सुरक्षित ट्रांजैक्शन]: पिन अनिवार्य वेरिफिकेशन लॉजिक
window.processPayment = async () => {
    if (!globalActiveMerchant) return;
    
    const amountStr = document.getElementById('payAmount').value;
    const billStr = document.getElementById('payBillAmount').value;
    const inputPin = document.getElementById('paySecurityPin').value.trim();

    if (!amountStr || !billStr || inputPin.length !== 4) {
        return showCustomAlert("अधूरा फॉर्म ❌", "कृपया एसेट राशि, बिल राशि और अपना 4 अंकों का सुरक्षा पिन डालें!", "error");
    }

    const payAmount = Number(amountStr);
    const billAmount = Number(billStr);
    const mMobile = globalActiveMerchant.mobile;

    if (billAmount < (globalActiveMerchant.minBillAmount || 100)) return showCustomAlert("नियम उल्लंघन ❌", "न्यूनतम बिल राशि की शर्त पूरी नहीं है।", "error");
    if (payAmount > (globalActiveMerchant.perTxnLimit || 5000)) return showCustomAlert("नियम उल्लंघन ❌", "एक बार की ट्रांजैक्शन लिमिट से अधिक राशि है।", "error");

    try {
        const userRef = doc(db, "users", mobile);
        const userDoc = await getDoc(userRef);
        const uData = userDoc.data();
        
        // 🔑 1. सुरक्षा कवच: पहले यूजर का पिन चेक करें
        const registeredPin = uData.securityPin;
        if (!registeredPin) {
            return showCustomAlert("पिन सेट नहीं है 🔒", "भुगतान करने से पहले तीन लाइन वाले मेनू में जाकर अपना 4 अंकों का सुरक्षा पिन बनाएं!", "error");
        }
        if (inputPin !== registeredPin) {
            return showCustomAlert("गलत पिन ❌", "आपका सुरक्षा पिन (Security PIN) गलत है! ट्रांजैक्शन ब्लॉक कर दिया गया है।", "error");
        }

        // 2. यूजर के बैलेंस की जांच
        const userCurrentBal = uData.balance || 0;
        if (userCurrentBal < payAmount) return showCustomAlert("लो बैलेंस ❌", "वॉलेट में पर्याप्त सिक्के नहीं हैं!", "error");

        // 3. सब कुछ सही होने पर पेमेंट प्रोसेस करें
        const newTxRef = doc(collection(db, "merchant_transactions"));
        const currentMerchantBalance = globalActiveMerchant.balance || 0;
        const finalUserBal = userCurrentBal - payAmount;
        
        await Promise.all([
            setDoc(userRef, { balance: finalUserBal }, { merge: true }),
            setDoc(doc(db, "merchants", mMobile), { balance: currentMerchantBalance + payAmount }, { merge: true }),
            setDoc(newTxRef, { txId: newTxRef.id, userMobile: mobile, merchantMobile: mMobile, amount: payAmount, billAmount: billAmount, timestamp: new Date().toISOString() })
        ]);

        sessionStorage.setItem('cash_balance', finalUserBal);
        const successShopName = globalActiveMerchant.shopName;
        window.openPaymentArea();
        
        // शत-प्रतिशत लाइव रिस्पांस
        showCustomAlert("भुगतान सफल! 💸", `सफलतापूर्वक ${payAmount} एसेट ${successShopName} को ट्रांसफर हो गए हैं।`, "success");
        renderDashboardUI(sessionStorage.getItem('cash_name'), finalUserBal);
    } catch (e) { showCustomAlert("Error ❌", "भुगतान विफल हुआ!", "error"); }
};

window.logout = () => {
    localStorage.removeItem('userMobile');
    sessionStorage.clear();
    location.reload();
};

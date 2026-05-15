import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

let currentMerchantMobile = localStorage.getItem('merchantMobile');

// पेज लोड होते ही लॉगिन स्टेटस चेक करें
window.addEventListener('DOMContentLoaded', async () => {
    if (currentMerchantMobile) {
        window.showDashboard();
    }
});

// लॉगिन और रजिस्ट्रेशन फॉर्म के बीच स्विच करने के लिए
window.toggleAuth = (showRegister) => {
    document.getElementById('loginForm').classList.toggle('hidden', showRegister);
    document.getElementById('registerForm').classList.toggle('hidden', !showRegister);
    document.getElementById('authTitle').innerText = showRegister ? "नया दुकानदार रजिस्ट्रेशन" : "दुकानदार लॉगिन (Merchant Login)";
};

// 🏪 दुकानदार रजिस्ट्रेशन लॉजिक
window.merchantRegister = async () => {
    const name = document.getElementById('regShopName').value.trim();
    const address = document.getElementById('regAddress').value.trim();
    const mobile = document.getElementById('regMobile').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value;

    if (!name || !address || !mobile || !email || !pass) {
        alert("कृपया सभी जानकारी भरें! (Please fill all fields)");
        return;
    }

    if (mobile.length !== 10) {
        alert("मोबाइल नंबर पूरा 10 अंकों का होना चाहिए!");
        return;
    }

    try {
        const mRef = doc(db, "merchants", mobile);
        const mSnap = await getDoc(mRef);

        if (mSnap.exists()) {
            alert("यह मोबाइल नंबर पहले से रजिस्टर्ड है! (Mobile already registered)");
            return;
        }

        await setDoc(mRef, {
            shopName: name,
            address: address,
            mobile: mobile,
            email: email,
            password: pass,
            balance: 0,
            perTxnLimit: 5000, 
            monthlyLimit: 20000, 
            minBillAmount: 100,
            regDate: new Date().toISOString()
        });

        alert("बधाई हो! दुकानदार रजिस्ट्रेशन सफल रहा। ✅\nअब आप लॉगिन कर सकते हैं।");
        window.toggleAuth(false);

    } catch (e) { 
        alert("रजिस्ट्रेशन फेल हुआ: " + e.message); 
    }
};

// 🔑 दुकानदार लॉगिन
window.merchantLogin = async () => {
    const mobile = document.getElementById('loginMobile').value.trim();
    const pass = document.getElementById('loginPass').value;

    if (!mobile || !pass) {
        alert("कृपया मोबाइल नंबर और पासवर्ड दर्ज करें!");
        return;
    }

    try {
        const mSnap = await getDoc(doc(db, "merchants", mobile));
        if (mSnap.exists() && mSnap.data().password === pass) {
            localStorage.setItem('merchantMobile', mobile);
            currentMerchantMobile = mobile;
            window.showDashboard();
        } else {
            alert("गलत मोबाइल नंबर या पासवर्ड!");
        }
    } catch (e) { alert("लॉगिन एरर!"); }
};

// 📊 डैशबोर्ड लोड करना (QR कोड फिक्स के साथ)
window.showDashboard = async () => {
    document.getElementById('merchantAuthSection').classList.add('hidden');
    document.getElementById('merchantDashboard').classList.remove('hidden');

    try {
        const mSnap = await getDoc(doc(db, "merchants", currentMerchantMobile));
        if (mSnap.exists()) {
            const data = mSnap.data();
            document.getElementById('lblShopName').innerText = data.shopName;
            document.getElementById('lblMerchantPhone').innerText = "Shop ID: +91 " + data.mobile;
            document.getElementById('lblMerchantBalance').innerText = data.balance || 0;
            
            // क्यूआर कार्ड के नीचे दुकान की जानकारी अपडेट करें
            document.getElementById('qrShopNameLabel').innerText = data.shopName;
            document.getElementById('qrShopPhoneLabel').innerText = "Shop ID: +91 " + data.mobile;

            document.getElementById('setPerTxnLimit').value = data.perTxnLimit || 5000;
            document.getElementById('setMonthlyLimit').value = data.monthlyLimit || 20000;
            document.getElementById('setMinBill').value = data.minBillAmount || 100;

            // 🔲 न्यू फिक्स्ड क्यूआर कोड लिंक (ताकि इमेज 100% लोड हो)
            const qrPayload = "REHLI-PAY:" + data.mobile;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrPayload)}`;
            document.getElementById('shopQrImg').src = qrUrl;

            await loadRecentTransactions();
        }
    } catch (e) { console.error(e); }
};

// 📋 सिर्फ हालिया 5 ट्रांजैक्शन लोड करना
async function loadRecentTransactions() {
    const txBody = document.getElementById('merchantTxBody');
    try {
        const q = query(
            collection(db, "merchant_transactions"),
            where("merchantMobile", "==", currentMerchantMobile),
            orderBy("timestamp", "desc"),
            limit(5)
        );
        
        const snap = await getDocs(q);
        if (snap.empty) return;

        txBody.innerHTML = "";
        snap.forEach(docSnap => {
            const tx = docSnap.data();
            const dateStr = tx.timestamp ? tx.timestamp.substring(0,10) : '-';
            txBody.innerHTML += `<tr>
                <td><b>+91 ${tx.userMobile}</b></td>
                <td style="color:#2ecc71; font-weight:600;">+${tx.amount} एसेट</td>
                <td>${dateStr}</td>
            </tr>`;
        });
    } catch (e) { console.error(e); }
}

// 📲 1. क्यूआर कोड व्हाट्सएप/अन्य ऐप्स पर शेयर करने का फीचर
window.shareShopQR = async () => {
    const shopName = document.getElementById('lblShopName').innerText;
    const qrImgSrc = document.getElementById('shopQrImg').src;

    if (navigator.share) {
        try {
            await navigator.share({
                title: shopName + ' - QR कोड',
                text: `रहलीजिटल एसेट पेमेंट के लिए *${shopName}* का QR कोड। इस लिंक से सीधे स्कैन करें:`,
                url: qrImgSrc
            });
        } catch (err) {
            console.log("Sharing failed or cancelled");
        }
    } else {
        // अगर ब्राउज़र शेयर एपीआई सपोर्ट नहीं करता तो क्लिपबोर्ड पर लिंक कॉपी हो जाएगी
        navigator.clipboard.writeText(qrImgSrc);
        alert("QR कोड का लिंक कॉपी कर लिया गया है! आप इसे कहीं भी पेस्ट करके शेयर कर सकते हैं।");
    }
};

// 💾 2. क्यूआर कोड को PDF के रूप में सेव/प्रिंट करने का डिजिटल फीचर
window.downloadQRAsPDF = () => {
    const printContents = document.getElementById('qrPrintArea').innerHTML;
    const originalContents = document.body.innerHTML;

    // एक नया अस्थायी प्रिंट विंडो ढांचा तैयार करना
    document.body.innerHTML = `
        <div style="text-align:center; padding:50px; font-family:'Poppins', sans-serif;">
            <h2 style="color:#2c3e50; margin-bottom:5px;">रहली डिजिटल एसेट पेमेंट</h2>
            <p style="font-size:12px; color:#666; margin-top:0; margin-bottom:30px;">स्थानीय डिजिटल करेंसी नेटवर्क</p>
            ${printContents}
            <p style="margin-top:40px; font-size:11px; color:#999;">ग्राहक इस कोड को अपने एसेट ऐप से स्कैन करके भुगतान करें</p>
        </div>
    `;

    // ब्राउज़र का प्रिंट डायलॉग खोलना (यहाँ से यूजर 'Save as PDF' चुन सकता है)
    window.print();

    // प्रिंट होने के बाद मूल डैशबोर्ड स्क्रीन वापस लाना
    document.body.innerHTML = originalContents;
    location.reload(); // पेज रिफ्रेश करके स्टेट रीस्टोर करना
};

// ⚙️ बिजनेस रूल्स/लिमिट सेव करना
window.saveMerchantRules = async () => {
    const perTxn = document.getElementById('setPerTxnLimit').value;
    const monthly = document.getElementById('setMonthlyLimit').value;
    const minBill = document.getElementById('setMinBill').value;

    try {
        await setDoc(doc(db, "merchants", currentMerchantMobile), {
            perTxnLimit: Number(perTxn),
            monthlyLimit: Number(monthly),
            minBillAmount: Number(minBill)
        }, { merge: true });

        alert("व्यापार नियम सफलतापूर्वक अपडेट हो गए हैं! ✅");
        location.reload();
    } catch (e) { alert("सेव एरर!"); }
};

window.merchantLogout = () => {
    localStorage.removeItem('merchantMobile');
    location.reload();
};

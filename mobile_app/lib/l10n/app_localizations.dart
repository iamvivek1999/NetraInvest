// Enigma Invest — Static localization string maps for EN / HI / MR
// Usage:  AppL10n.of(context).appName
//
// No code generation needed, no flutter_localizations dependency.
// Simply add new keys here and use them across the app.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/language_provider.dart';

// ─── Master string class ──────────────────────────────────────────────────────

class AppStrings {
  // App
  final String appName;
  final String appTagline;

  // Common
  final String ok;
  final String cancel;
  final String retry;
  final String save;
  final String skip;
  final String confirm;
  final String loading;
  final String error;
  final String success;
  final String required;
  final String submit;
  final String logout;
  final String noDataYet;
  final String refresh;

  // Validation
  final String pleaseEnterEmail;
  final String pleaseEnterValidEmail;
  final String pleaseEnterPassword;
  final String passwordTooShort;
  final String pleaseEnterName;
  final String nameTooShort;
  final String pleaseEnterPhone;
  final String pleaseEnterAadhaar;
  final String aadhaarMustBe12;
  final String pleaseEnterStreet;
  final String pleaseEnterPincode;
  final String pincodeMustBe6;
  final String pleaseEnterAmount;
  final String minimumAmount;
  final String pleaseEnterReason;
  final String reasonTooShort;

  // Auth / Login
  final String login;
  final String dontHaveAccount;
  final String loginFailed;

  // Auth / Register
  final String register;
  final String createAccount;
  final String alreadyHaveAccount;
  final String walletAutoCreated;
  final String iAm;
  final String borrower;
  final String lender;
  final String needALoan;
  final String investMoney;
  final String basicInfo;
  final String fullName;
  final String email;
  final String password;
  final String kycInformation;
  final String phoneNumber;
  final String aadhaarNumber;
  final String streetAddress;
  final String city;
  final String state;
  final String pincode;
  final String registrationFailed;

  // Language selection
  final String selectLanguage;
  final String selectLanguageSubtitle;
  final String languageEnglish;
  final String languageHindi;
  final String languageMarathi;
  final String languageLabel;
  final String changeLanguage;
  final String languageChanged;

  // Borrower Dashboard
  final String borrowerDashboard;
  final String myProfile;
  final String noLoansYet;
  final String createFirstLoan;
  final String requestLoan;
  final String createLoan;
  final String acceptLoan;
  final String loanAccepted;
  final String repayLoan;
  final String loanRequestCreated;
  final String failedToAcceptLoan;
  final String amount;
  final String duration;
  final String reason;
  final String interestRate;
  final String monthlyEmi;
  final String platformFeeNote;
  final String rateBasedOnScore;
  final String kycRequiredTitle;
  final String kycRequiredBody;
  final String completeKycNow;
  final String payNextEmiTitle;
  final String emiOverdue;
  final String principalRepaid;
  final String interest;
  final String emiAmount;
  final String latePenalty;
  final String totalDueNow;
  final String reducingBalanceNote;
  final String emiPaidSuccess;
  final String repaymentFailed;

  // Lender Dashboard
  final String lenderDashboard;
  final String availableLoans;
  final String myInvestments;
  final String noAvailableLoans;
  final String noInvestmentsYet;
  final String fund;
  final String fundLoan;
  final String investmentSuccess;
  final String investmentFailed;

  // Profile — common
  final String walletBalance;
  final String availableBalance;
  final String addFunds;
  final String kycVerified;
  final String kycUnderReview;
  final String kycRejected;
  final String completeKyc;
  final String languageSettingLabel;

  // Profile — borrower
  final String creditScore;
  final String loanSummary;
  final String totalLoans;
  final String totalBorrowed;
  final String totalRepaid;
  final String activeLoans;
  final String autoPayEmi;
  final String autoPayEnabled;
  final String autoPayDisabled;
  final String autoPayToggleSuccess;
  final String autoPayToggleFailed;
  final String loanHistory;
  final String activeLoansSection;

  // Profile — lender
  final String myPortfolio;
  final String portfolioSummary;
  final String totalInvested;
  final String totalReturns;
  final String profitLoss;
  final String activeInvestments;
  final String investmentHistory;

  // KYC Screen
  final String kycVerification;
  final String kycDescription;
  final String uploadAadhaar;
  final String uploadPan;
  final String uploadSelfie;
  final String submitKyc;
  final String kycSubmitted;
  final String tapToUpload;
  final String uploaded;

  // Chat
  final String chatHint;
  final String newConversation;
  final String applyForLoan;
  final String payNextEmi;
  final String checkEmiStatus;
  final String checkKycStatus;
  final String viewCreditScore;
  final String viewMyLoans;
  final String chatWelcome;
  final String chatReset;

  // Extra
  final String outOf1000;
  final String lockedFundsLoans;
  final String lockedFundsInvestments;
  final String addFundsHint;
  final String borrowerLabel;
  final String lenderLabel;

  const AppStrings({
    required this.appName,
    required this.appTagline,
    required this.ok,
    required this.cancel,
    required this.retry,
    required this.save,
    required this.skip,
    required this.confirm,
    required this.loading,
    required this.error,
    required this.success,
    required this.required,
    required this.submit,
    required this.logout,
    required this.noDataYet,
    required this.refresh,
    required this.pleaseEnterEmail,
    required this.pleaseEnterValidEmail,
    required this.pleaseEnterPassword,
    required this.passwordTooShort,
    required this.pleaseEnterName,
    required this.nameTooShort,
    required this.pleaseEnterPhone,
    required this.pleaseEnterAadhaar,
    required this.aadhaarMustBe12,
    required this.pleaseEnterStreet,
    required this.pleaseEnterPincode,
    required this.pincodeMustBe6,
    required this.pleaseEnterAmount,
    required this.minimumAmount,
    required this.pleaseEnterReason,
    required this.reasonTooShort,
    required this.login,
    required this.dontHaveAccount,
    required this.loginFailed,
    required this.register,
    required this.createAccount,
    required this.alreadyHaveAccount,
    required this.walletAutoCreated,
    required this.iAm,
    required this.borrower,
    required this.lender,
    required this.needALoan,
    required this.investMoney,
    required this.basicInfo,
    required this.fullName,
    required this.email,
    required this.password,
    required this.kycInformation,
    required this.phoneNumber,
    required this.aadhaarNumber,
    required this.streetAddress,
    required this.city,
    required this.state,
    required this.pincode,
    required this.registrationFailed,
    required this.selectLanguage,
    required this.selectLanguageSubtitle,
    required this.languageEnglish,
    required this.languageHindi,
    required this.languageMarathi,
    required this.languageLabel,
    required this.changeLanguage,
    required this.languageChanged,
    required this.borrowerDashboard,
    required this.myProfile,
    required this.noLoansYet,
    required this.createFirstLoan,
    required this.requestLoan,
    required this.createLoan,
    required this.acceptLoan,
    required this.loanAccepted,
    required this.repayLoan,
    required this.loanRequestCreated,
    required this.failedToAcceptLoan,
    required this.amount,
    required this.duration,
    required this.reason,
    required this.interestRate,
    required this.monthlyEmi,
    required this.platformFeeNote,
    required this.rateBasedOnScore,
    required this.kycRequiredTitle,
    required this.kycRequiredBody,
    required this.completeKycNow,
    required this.payNextEmiTitle,
    required this.emiOverdue,
    required this.principalRepaid,
    required this.interest,
    required this.emiAmount,
    required this.latePenalty,
    required this.totalDueNow,
    required this.reducingBalanceNote,
    required this.emiPaidSuccess,
    required this.repaymentFailed,
    required this.lenderDashboard,
    required this.availableLoans,
    required this.myInvestments,
    required this.noAvailableLoans,
    required this.noInvestmentsYet,
    required this.fund,
    required this.fundLoan,
    required this.investmentSuccess,
    required this.investmentFailed,
    required this.walletBalance,
    required this.availableBalance,
    required this.addFunds,
    required this.kycVerified,
    required this.kycUnderReview,
    required this.kycRejected,
    required this.completeKyc,
    required this.languageSettingLabel,
    required this.creditScore,
    required this.loanSummary,
    required this.totalLoans,
    required this.totalBorrowed,
    required this.totalRepaid,
    required this.activeLoans,
    required this.autoPayEmi,
    required this.autoPayEnabled,
    required this.autoPayDisabled,
    required this.autoPayToggleSuccess,
    required this.autoPayToggleFailed,
    required this.loanHistory,
    required this.activeLoansSection,
    required this.myPortfolio,
    required this.portfolioSummary,
    required this.totalInvested,
    required this.totalReturns,
    required this.profitLoss,
    required this.activeInvestments,
    required this.investmentHistory,
    required this.kycVerification,
    required this.kycDescription,
    required this.uploadAadhaar,
    required this.uploadPan,
    required this.uploadSelfie,
    required this.submitKyc,
    required this.kycSubmitted,
    required this.tapToUpload,
    required this.uploaded,
    required this.chatHint,
    required this.newConversation,
    required this.applyForLoan,
    required this.payNextEmi,
    required this.checkEmiStatus,
    required this.checkKycStatus,
    required this.viewCreditScore,
    required this.viewMyLoans,
    required this.chatWelcome,
    required this.chatReset,
    required this.outOf1000,
    required this.lockedFundsLoans,
    required this.lockedFundsInvestments,
    required this.addFundsHint,
    required this.borrowerLabel,
    required this.lenderLabel,
  });
}

// ─── English ──────────────────────────────────────────────────────────────────

const AppStrings _en = AppStrings(
  appName: 'Enigma Invest',
  appTagline: 'Decentralized Lending for Everyone',
  ok: 'OK',
  cancel: 'Cancel',
  retry: 'Retry',
  save: 'Save',
  skip: 'Skip',
  confirm: 'Confirm',
  loading: 'Loading...',
  error: 'Error',
  success: 'Success',
  required: 'Required',
  submit: 'Submit',
  logout: 'Logout',
  noDataYet: 'No data yet',
  refresh: 'Refresh',
  pleaseEnterEmail: 'Please enter your email',
  pleaseEnterValidEmail: 'Please enter a valid email',
  pleaseEnterPassword: 'Please enter your password',
  passwordTooShort: 'Password must be at least 6 characters',
  pleaseEnterName: 'Please enter your name',
  nameTooShort: 'Name must be at least 2 characters',
  pleaseEnterPhone: 'Please enter your phone number',
  pleaseEnterAadhaar: 'Please enter your Aadhaar number',
  aadhaarMustBe12: 'Aadhaar must be 12 digits',
  pleaseEnterStreet: 'Please enter your street address',
  pleaseEnterPincode: 'Please enter pincode',
  pincodeMustBe6: 'Pincode must be 6 digits',
  pleaseEnterAmount: 'Please enter amount',
  minimumAmount: 'Minimum ₹1,000',
  pleaseEnterReason: 'Please enter reason',
  reasonTooShort: 'At least 10 characters',
  login: 'Login',
  dontHaveAccount: "Don't have an account? Register",
  loginFailed: 'Login failed',
  register: 'Register',
  createAccount: 'Create Account',
  alreadyHaveAccount: 'Already have an account? Login',
  walletAutoCreated: 'Your INR wallet will be created automatically',
  iAm: 'I am a:',
  borrower: 'Borrower',
  lender: 'Lender',
  needALoan: 'Need a loan',
  investMoney: 'Invest money',
  basicInfo: 'Basic Information',
  fullName: 'Full Name',
  email: 'Email',
  password: 'Password',
  kycInformation: 'KYC Information',
  phoneNumber: 'Phone Number',
  aadhaarNumber: 'Aadhaar Number',
  streetAddress: 'Street Address',
  city: 'City',
  state: 'State',
  pincode: 'Pincode',
  registrationFailed: 'Registration failed',
  selectLanguage: 'Select Language',
  selectLanguageSubtitle: 'Choose your preferred language for the app',
  languageEnglish: 'English',
  languageHindi: 'हिंदी (Hindi)',
  languageMarathi: 'मराठी (Marathi)',
  languageLabel: 'Language',
  changeLanguage: 'Change Language',
  languageChanged: 'Language updated successfully',
  borrowerDashboard: 'Borrower Dashboard',
  myProfile: 'My Profile',
  noLoansYet: 'No loans yet',
  createFirstLoan: 'Create your first loan request',
  requestLoan: 'Request a Loan',
  createLoan: 'Create Loan',
  acceptLoan: 'Accept Loan',
  loanAccepted: 'Loan accepted! Funds transferred to your wallet.',
  repayLoan: 'Repay Loan',
  loanRequestCreated: 'Loan request created! Rate & EMI confirmed by server.',
  failedToAcceptLoan: 'Failed to accept loan',
  amount: 'Amount (₹)',
  duration: 'Duration (months)',
  reason: 'Reason',
  interestRate: 'Interest Rate',
  monthlyEmi: 'Monthly EMI',
  platformFeeNote: '4% platform fee deducted on loan acceptance.',
  rateBasedOnScore:
      'Rate is based on your credit score. Final rate confirmed on submission.',
  kycRequiredTitle: 'KYC Verification Required',
  kycRequiredBody:
      'You must complete KYC verification before creating a loan request.',
  completeKycNow: 'Complete KYC Now',
  payNextEmiTitle: 'Pay Next EMI',
  emiOverdue: 'EMI Overdue!',
  principalRepaid: 'Principal repaid',
  interest: 'Interest (reducing balance)',
  emiAmount: 'EMI Amount',
  latePenalty: 'Late Penalty (2%)',
  totalDueNow: 'Total Due Now',
  reducingBalanceNote:
      'Reducing balance method: each EMI pays decreasing interest and increasing principal.',
  emiPaidSuccess: 'EMI paid successfully!',
  repaymentFailed: 'Repayment failed',
  lenderDashboard: 'Lender Dashboard',
  availableLoans: 'Available Loans',
  myInvestments: 'My Investments',
  noAvailableLoans: 'No loans available',
  noInvestmentsYet: 'No investments yet',
  fund: 'Fund',
  fundLoan: 'Fund Loan',
  investmentSuccess: 'Investment successful!',
  investmentFailed: 'Investment failed',
  walletBalance: 'Wallet Balance',
  availableBalance: 'Available Balance',
  addFunds: 'Add Funds',
  kycVerified: 'KYC Verified',
  kycUnderReview: 'KYC Under Review',
  kycRejected: 'KYC Rejected',
  completeKyc: 'Complete KYC Verification',
  languageSettingLabel: 'Language / भाषा',
  creditScore: 'Credit Score',
  loanSummary: 'Loan Summary',
  totalLoans: 'Total Loans',
  totalBorrowed: 'Total Borrowed',
  totalRepaid: 'Total Repaid',
  activeLoans: 'Active Loans',
  autoPayEmi: 'Auto-Pay EMI',
  autoPayEnabled: 'EMIs will be auto-deducted on their due date.',
  autoPayDisabled: 'Enable to auto-deduct EMIs on their due date.',
  autoPayToggleSuccess: '✅ Auto-pay enabled',
  autoPayToggleFailed: 'Failed to toggle auto-pay',
  loanHistory: 'Loan History',
  activeLoansSection: 'Active Loans',
  myPortfolio: 'My Portfolio',
  portfolioSummary: 'Portfolio Summary',
  totalInvested: 'Total Invested',
  totalReturns: 'Total Returns',
  profitLoss: 'Profit/Loss',
  activeInvestments: 'Active Investments',
  investmentHistory: 'Investment History',
  kycVerification: 'KYC Verification',
  kycDescription: 'Upload your documents to verify your identity',
  uploadAadhaar: 'Upload Aadhaar',
  uploadPan: 'Upload PAN',
  uploadSelfie: 'Upload Selfie',
  submitKyc: 'Submit for Verification',
  kycSubmitted: 'KYC submitted successfully!',
  tapToUpload: 'Tap to upload',
  uploaded: 'Uploaded ✓',
  chatHint: 'Ask LenAI anything...',
  newConversation: 'New conversation',
  applyForLoan: '💰 Apply for Loan',
  payNextEmi: '💳 Pay Next EMI',
  checkEmiStatus: '📋 Check EMI Status',
  checkKycStatus: '🪪 Check KYC Status',
  viewCreditScore: '⭐ View Credit Score',
  viewMyLoans: '📂 View My Loans',
  chatWelcome:
      'Hello! I\'m **LenAI** 👋\n\nI\'m your personal financial operations agent. I can:\n\n• Apply for a loan on your behalf\n• Pay your next EMI\n• Check EMI schedule, KYC status & credit score\n• View all your loans\n\nWhat would you like to do today?',
  chatReset: 'Conversation reset. 👋 What would you like to do today?',
  outOf1000: 'out of 1000',
  lockedFundsLoans: 'Locked (in active loans)',
  lockedFundsInvestments: 'Locked (in investments)',
  addFundsHint: 'Add test funds to your wallet',
  borrowerLabel: 'Borrower',
  lenderLabel: 'Lender',
);

// ─── Hindi ────────────────────────────────────────────────────────────────────

const AppStrings _hi = AppStrings(
  appName: 'Enigma Invest',
  appTagline: 'सबके लिए विकेंद्रीकृत ऋण',
  ok: 'ठीक है',
  cancel: 'रद्द करें',
  retry: 'पुनः प्रयास करें',
  save: 'सहेजें',
  skip: 'छोड़ें',
  confirm: 'पुष्टि करें',
  loading: 'लोड हो रहा है...',
  error: 'त्रुटि',
  success: 'सफलता',
  required: 'आवश्यक',
  submit: 'जमा करें',
  logout: 'लॉगआउट',
  noDataYet: 'अभी कोई डेटा नहीं',
  refresh: 'ताज़ा करें',
  pleaseEnterEmail: 'कृपया अपना ईमेल दर्ज करें',
  pleaseEnterValidEmail: 'कृपया एक वैध ईमेल दर्ज करें',
  pleaseEnterPassword: 'कृपया अपना पासवर्ड दर्ज करें',
  passwordTooShort: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए',
  pleaseEnterName: 'कृपया अपना नाम दर्ज करें',
  nameTooShort: 'नाम कम से कम 2 अक्षर का होना चाहिए',
  pleaseEnterPhone: 'कृपया अपना फोन नंबर दर्ज करें',
  pleaseEnterAadhaar: 'कृपया अपना आधार नंबर दर्ज करें',
  aadhaarMustBe12: 'आधार 12 अंकों का होना चाहिए',
  pleaseEnterStreet: 'कृपया अपना सड़क का पता दर्ज करें',
  pleaseEnterPincode: 'कृपया पिनकोड दर्ज करें',
  pincodeMustBe6: 'पिनकोड 6 अंकों का होना चाहिए',
  pleaseEnterAmount: 'कृपया राशि दर्ज करें',
  minimumAmount: 'न्यूनतम ₹1,000',
  pleaseEnterReason: 'कृपया कारण दर्ज करें',
  reasonTooShort: 'कम से कम 10 अक्षर',
  login: 'लॉगिन',
  dontHaveAccount: 'खाता नहीं है? पंजीकरण करें',
  loginFailed: 'लॉगिन विफल',
  register: 'पंजीकरण करें',
  createAccount: 'खाता बनाएं',
  alreadyHaveAccount: 'पहले से खाता है? लॉगिन करें',
  walletAutoCreated: 'आपका INR वॉलेट स्वचालित रूप से बन जाएगा',
  iAm: 'मैं हूँ:',
  borrower: 'उधारकर्ता',
  lender: 'ऋणदाता',
  needALoan: 'ऋण चाहिए',
  investMoney: 'पैसे निवेश करें',
  basicInfo: 'बुनियादी जानकारी',
  fullName: 'पूरा नाम',
  email: 'ईमेल',
  password: 'पासवर्ड',
  kycInformation: 'KYC जानकारी',
  phoneNumber: 'फोन नंबर',
  aadhaarNumber: 'आधार नंबर',
  streetAddress: 'सड़क का पता',
  city: 'शहर',
  state: 'राज्य',
  pincode: 'पिनकोड',
  registrationFailed: 'पंजीकरण विफल',
  selectLanguage: 'भाषा चुनें',
  selectLanguageSubtitle: 'ऐप के लिए अपनी पसंदीदा भाषा चुनें',
  languageEnglish: 'English',
  languageHindi: 'हिंदी (Hindi)',
  languageMarathi: 'मराठी (Marathi)',
  languageLabel: 'भाषा',
  changeLanguage: 'भाषा बदलें',
  languageChanged: 'भाषा सफलतापूर्वक बदल दी गई',
  borrowerDashboard: 'उधारकर्ता डैशबोर्ड',
  myProfile: 'मेरी प्रोफ़ाइल',
  noLoansYet: 'अभी कोई ऋण नहीं',
  createFirstLoan: 'अपना पहला ऋण अनुरोध बनाएं',
  requestLoan: 'ऋण का अनुरोध करें',
  createLoan: 'ऋण बनाएं',
  acceptLoan: 'ऋण स्वीकार करें',
  loanAccepted: 'ऋण स्वीकृत! धनराशि आपके वॉलेट में स्थानांतरित हो गई।',
  repayLoan: 'ऋण चुकाएं',
  loanRequestCreated:
      'ऋण अनुरोध बनाया गया! दर और EMI सर्वर द्वारा पुष्टि की गई।',
  failedToAcceptLoan: 'ऋण स्वीकार करने में विफल',
  amount: 'राशि (₹)',
  duration: 'अवधि (महीने)',
  reason: 'कारण',
  interestRate: 'ब्याज दर',
  monthlyEmi: 'मासिक EMI',
  platformFeeNote: 'ऋण स्वीकृति पर 4% प्लेटफ़ॉर्म शुल्क काटा जाएगा।',
  rateBasedOnScore:
      'दर आपके क्रेडिट स्कोर पर आधारित है। जमा करने पर अंतिम दर की पुष्टि।',
  kycRequiredTitle: 'KYC सत्यापन आवश्यक',
  kycRequiredBody: 'ऋण अनुरोध बनाने से पहले KYC सत्यापन पूरा करना आवश्यक है।',
  completeKycNow: 'अभी KYC पूरा करें',
  payNextEmiTitle: 'अगली EMI चुकाएं',
  emiOverdue: 'EMI बकाया!',
  principalRepaid: 'मूलधन चुकाया गया',
  interest: 'ब्याज (घटता बैलेंस)',
  emiAmount: 'EMI राशि',
  latePenalty: 'देरी का जुर्माना (2%)',
  totalDueNow: 'अभी कुल देय',
  reducingBalanceNote:
      'घटता बैलेंस विधि: प्रत्येक EMI घटते ब्याज और बढ़ते मूलधन का भुगतान करती है।',
  emiPaidSuccess: 'EMI सफलतापूर्वक चुकाई गई!',
  repaymentFailed: 'भुगतान विफल',
  lenderDashboard: 'ऋणदाता डैशबोर्ड',
  availableLoans: 'उपलब्ध ऋण',
  myInvestments: 'मेरे निवेश',
  noAvailableLoans: 'कोई ऋण उपलब्ध नहीं',
  noInvestmentsYet: 'अभी तक कोई निवेश नहीं',
  fund: 'फंड करें',
  fundLoan: 'ऋण फंड करें',
  investmentSuccess: 'निवेश सफल!',
  investmentFailed: 'निवेश विफल',
  walletBalance: 'वॉलेट बैलेंस',
  availableBalance: 'उपलब्ध बैलेंस',
  addFunds: 'राशि जोड़ें',
  kycVerified: 'KYC सत्यापित',
  kycUnderReview: 'KYC समीक्षाधीन',
  kycRejected: 'KYC अस्वीकृत',
  completeKyc: 'KYC सत्यापन पूरा करें',
  languageSettingLabel: 'Language / भाषा',
  creditScore: 'क्रेडिट स्कोर',
  loanSummary: 'ऋण सारांश',
  totalLoans: 'कुल ऋण',
  totalBorrowed: 'कुल उधार लिया',
  totalRepaid: 'कुल वापस किया',
  activeLoans: 'सक्रिय ऋण',
  autoPayEmi: 'ऑटो-पे EMI',
  autoPayEnabled: 'EMI नियत तारीख पर स्वचालित रूप से कट जाएगी।',
  autoPayDisabled: 'नियत तारीख पर EMI स्वतः कटवाने के लिए सक्षम करें।',
  autoPayToggleSuccess: '✅ ऑटो-पे सक्षम',
  autoPayToggleFailed: 'ऑटो-पे बदलने में विफल',
  loanHistory: 'ऋण इतिहास',
  activeLoansSection: 'सक्रिय ऋण',
  myPortfolio: 'मेरा पोर्टफोलियो',
  portfolioSummary: 'पोर्टफोलियो सारांश',
  totalInvested: 'कुल निवेश',
  totalReturns: 'कुल रिटर्न',
  profitLoss: 'लाभ/हानि',
  activeInvestments: 'सक्रिय निवेश',
  investmentHistory: 'निवेश इतिहास',
  kycVerification: 'KYC सत्यापन',
  kycDescription: 'अपनी पहचान सत्यापित करने के लिए दस्तावेज़ अपलोड करें',
  uploadAadhaar: 'आधार अपलोड करें',
  uploadPan: 'PAN अपलोड करें',
  uploadSelfie: 'सेल्फी अपलोड करें',
  submitKyc: 'सत्यापन के लिए जमा करें',
  kycSubmitted: 'KYC सफलतापूर्वक जमा किया गया!',
  tapToUpload: 'अपलोड करने के लिए टैप करें',
  uploaded: 'अपलोड हो गया ✓',
  chatHint: 'LenAI से कुछ भी पूछें...',
  newConversation: 'नई बातचीत',
  applyForLoan: '💰 ऋण के लिए आवेदन करें',
  payNextEmi: '💳 अगली EMI चुकाएं',
  checkEmiStatus: '📋 EMI स्थिति जांचें',
  checkKycStatus: '🪪 KYC स्थिति जांचें',
  viewCreditScore: '⭐ क्रेडिट स्कोर देखें',
  viewMyLoans: '📂 मेरे ऋण देखें',
  chatWelcome:
      'नमस्ते! मैं **LenAI** हूँ 👋\n\nमैं आपका व्यक्तिगत वित्तीय संचालन एजेंट हूँ। मैं कर सकता हूँ:\n\n• आपकी ओर से ऋण के लिए आवेदन\n• आपकी अगली EMI चुकाना\n• EMI शेड्यूल, KYC स्थिति और क्रेडिट स्कोर जाँचना\n• आपके सभी ऋण देखना\n\nआज आप क्या करना चाहेंगे?',
  chatReset: 'बातचीत रीसेट हो गई। 👋 आज आप क्या करना चाहेंगे?',
  outOf1000: '1000 में से',
  lockedFundsLoans: 'लॉक (सक्रिय ऋणों में)',
  lockedFundsInvestments: 'लॉक (निवेशों में)',
  addFundsHint: 'अपने वॉलेट में टेस्ट राशि जोड़ें',
  borrowerLabel: 'उधारकर्ता',
  lenderLabel: 'ऋणदाता',
);

// ─── Marathi ──────────────────────────────────────────────────────────────────

const AppStrings _mr = AppStrings(
  appName: 'Enigma Invest',
  appTagline: 'सर्वांसाठी विकेंद्रित कर्ज',
  ok: 'ठीक आहे',
  cancel: 'रद्द करा',
  retry: 'पुन्हा प्रयत्न करा',
  save: 'जतन करा',
  skip: 'वगळा',
  confirm: 'पुष्टी करा',
  loading: 'लोड होत आहे...',
  error: 'त्रुटी',
  success: 'यश',
  required: 'आवश्यक',
  submit: 'सादर करा',
  logout: 'लॉगआउट',
  noDataYet: 'अद्याप डेटा नाही',
  refresh: 'ताजे करा',
  pleaseEnterEmail: 'कृपया तुमचा ईमेल प्रविष्ट करा',
  pleaseEnterValidEmail: 'कृपया वैध ईमेल प्रविष्ट करा',
  pleaseEnterPassword: 'कृपया तुमचा पासवर्ड प्रविष्ट करा',
  passwordTooShort: 'पासवर्ड किमान 6 अक्षरांचा असावा',
  pleaseEnterName: 'कृपया तुमचे नाव प्रविष्ट करा',
  nameTooShort: 'नाव किमान 2 अक्षरांचे असावे',
  pleaseEnterPhone: 'कृपया तुमचा फोन नंबर प्रविष्ट करा',
  pleaseEnterAadhaar: 'कृपया तुमचा आधार नंबर प्रविष्ट करा',
  aadhaarMustBe12: 'आधार 12 अंकांचा असावा',
  pleaseEnterStreet: 'कृपया तुमचा रस्त्याचा पत्ता प्रविष्ट करा',
  pleaseEnterPincode: 'कृपया पिनकोड प्रविष्ट करा',
  pincodeMustBe6: 'पिनकोड 6 अंकांचा असावा',
  pleaseEnterAmount: 'कृपया रक्कम प्रविष्ट करा',
  minimumAmount: 'किमान ₹1,000',
  pleaseEnterReason: 'कृपया कारण प्रविष्ट करा',
  reasonTooShort: 'किमान 10 अक्षरे',
  login: 'लॉगिन',
  dontHaveAccount: 'खाते नाही? नोंदणी करा',
  loginFailed: 'लॉगिन अयशस्वी',
  register: 'नोंदणी करा',
  createAccount: 'खाते तयार करा',
  alreadyHaveAccount: 'आधीच खाते आहे? लॉगिन करा',
  walletAutoCreated: 'तुमचे INR वॉलेट आपोआप तयार होईल',
  iAm: 'मी आहे:',
  borrower: 'कर्जदार',
  lender: 'कर्जदाता',
  needALoan: 'कर्ज हवे आहे',
  investMoney: 'पैसे गुंतवा',
  basicInfo: 'मूलभूत माहिती',
  fullName: 'पूर्ण नाव',
  email: 'ईमेल',
  password: 'पासवर्ड',
  kycInformation: 'KYC माहिती',
  phoneNumber: 'फोन नंबर',
  aadhaarNumber: 'आधार नंबर',
  streetAddress: 'रस्त्याचा पत्ता',
  city: 'शहर',
  state: 'राज्य',
  pincode: 'पिनकोड',
  registrationFailed: 'नोंदणी अयशस्वी',
  selectLanguage: 'भाषा निवडा',
  selectLanguageSubtitle: 'अॅपसाठी तुमची आवडती भाषा निवडा',
  languageEnglish: 'English',
  languageHindi: 'हिंदी (Hindi)',
  languageMarathi: 'मराठी (Marathi)',
  languageLabel: 'भाषा',
  changeLanguage: 'भाषा बदला',
  languageChanged: 'भाषा यशस्वीरित्या बदलली',
  borrowerDashboard: 'कर्जदार डॅशबोर्ड',
  myProfile: 'माझी प्रोफाईल',
  noLoansYet: 'अद्याप कोणतेही कर्ज नाही',
  createFirstLoan: 'तुमची पहिली कर्ज विनंती तयार करा',
  requestLoan: 'कर्जाची विनंती करा',
  createLoan: 'कर्ज तयार करा',
  acceptLoan: 'कर्ज स्वीकारा',
  loanAccepted: 'कर्ज स्वीकारले! रक्कम तुमच्या वॉलेटमध्ये हस्तांतरित झाली.',
  repayLoan: 'कर्ज परत करा',
  loanRequestCreated:
      'कर्ज विनंती तयार झाली! दर आणि EMI सर्व्हरने पुष्टी केली.',
  failedToAcceptLoan: 'कर्ज स्वीकारण्यात अयशस्वी',
  amount: 'रक्कम (₹)',
  duration: 'कालावधी (महिने)',
  reason: 'कारण',
  interestRate: 'व्याज दर',
  monthlyEmi: 'मासिक EMI',
  platformFeeNote: 'कर्ज स्वीकृतीवर 4% प्लॅटफॉर्म शुल्क कापले जाईल.',
  rateBasedOnScore:
      'दर तुमच्या क्रेडिट स्कोरवर आधारित आहे. सादरीकरणावर अंतिम दर पुष्टी.',
  kycRequiredTitle: 'KYC सत्यापन आवश्यक',
  kycRequiredBody:
      'कर्ज विनंती करण्यापूर्वी KYC सत्यापन पूर्ण करणे आवश्यक आहे.',
  completeKycNow: 'आता KYC पूर्ण करा',
  payNextEmiTitle: 'पुढील EMI भरा',
  emiOverdue: 'EMI थकबाकी!',
  principalRepaid: 'मुद्दल परत केले',
  interest: 'व्याज (घटणारी शिल्लक)',
  emiAmount: 'EMI रक्कम',
  latePenalty: 'उशीर दंड (2%)',
  totalDueNow: 'आता एकूण देय',
  reducingBalanceNote:
      'घटणारी शिल्लक पद्धत: प्रत्येक EMI कमी व्याज आणि जास्त मुद्दल भरते.',
  emiPaidSuccess: 'EMI यशस्वीरित्या भरली!',
  repaymentFailed: 'परतफेड अयशस्वी',
  lenderDashboard: 'कर्जदाता डॅशबोर्ड',
  availableLoans: 'उपलब्ध कर्जे',
  myInvestments: 'माझ्या गुंतवणुका',
  noAvailableLoans: 'कोणतेही कर्ज उपलब्ध नाही',
  noInvestmentsYet: 'अद्याप कोणतीही गुंतवणूक नाही',
  fund: 'निधी द्या',
  fundLoan: 'कर्जाला निधी द्या',
  investmentSuccess: 'गुंतवणूक यशस्वी!',
  investmentFailed: 'गुंतवणूक अयशस्वी',
  walletBalance: 'वॉलेट शिल्लक',
  availableBalance: 'उपलब्ध शिल्लक',
  addFunds: 'पैसे जोडा',
  kycVerified: 'KYC सत्यापित',
  kycUnderReview: 'KYC पुनरावलोकनाधीन',
  kycRejected: 'KYC नाकारले',
  completeKyc: 'KYC सत्यापन पूर्ण करा',
  languageSettingLabel: 'Language / भाषा',
  creditScore: 'क्रेडिट स्कोर',
  loanSummary: 'कर्ज सारांश',
  totalLoans: 'एकूण कर्जे',
  totalBorrowed: 'एकूण घेतलेले',
  totalRepaid: 'एकूण परत केलेले',
  activeLoans: 'सक्रिय कर्जे',
  autoPayEmi: 'ऑटो-पे EMI',
  autoPayEnabled: 'EMI देय तारखेला आपोआप कापली जाईल.',
  autoPayDisabled: 'देय तारखेला EMI आपोआप कापण्यासाठी सक्षम करा.',
  autoPayToggleSuccess: '✅ ऑटो-पे सक्षम',
  autoPayToggleFailed: 'ऑटो-पे बदलण्यात अयशस्वी',
  loanHistory: 'कर्ज इतिहास',
  activeLoansSection: 'सक्रिय कर्जे',
  myPortfolio: 'माझा पोर्टफोलिओ',
  portfolioSummary: 'पोर्टफोलिओ सारांश',
  totalInvested: 'एकूण गुंतवणूक',
  totalReturns: 'एकूण परतावा',
  profitLoss: 'नफा/तोटा',
  activeInvestments: 'सक्रिय गुंतवणुका',
  investmentHistory: 'गुंतवणूक इतिहास',
  kycVerification: 'KYC सत्यापन',
  kycDescription: 'तुमची ओळख सत्यापित करण्यासाठी कागदपत्रे अपलोड करा',
  uploadAadhaar: 'आधार अपलोड करा',
  uploadPan: 'PAN अपलोड करा',
  uploadSelfie: 'सेल्फी अपलोड करा',
  submitKyc: 'सत्यापनासाठी सादर करा',
  kycSubmitted: 'KYC यशस्वीरित्या सादर केले!',
  tapToUpload: 'अपलोड करण्यासाठी टॅप करा',
  uploaded: 'अपलोड झाले ✓',
  chatHint: 'LenAI ला काहीही विचारा...',
  newConversation: 'नवीन संभाषण',
  applyForLoan: '💰 कर्जासाठी अर्ज करा',
  payNextEmi: '💳 पुढील EMI भरा',
  checkEmiStatus: '📋 EMI स्थिती तपासा',
  checkKycStatus: '🪪 KYC स्थिती तपासा',
  viewCreditScore: '⭐ क्रेडिट स्कोर पहा',
  viewMyLoans: '📂 माझी कर्जे पहा',
  chatWelcome:
      'नमस्कार! मी **LenAI** आहे 👋\n\nमी तुमचा वैयक्तिक आर्थिक संचालन एजंट आहे. मी करू शकतो:\n\n• तुमच्यावतीने कर्जासाठी अर्ज\n• तुमची पुढील EMI भरणे\n• EMI वेळापत्रक, KYC स्थिती आणि क्रेडिट स्कोर तपासणे\n• तुमची सर्व कर्जे पाहणे\n\nआज तुम्हाला काय करायचे आहे?',
  chatReset: 'संभाषण रीसेट झाले. 👋 आज तुम्हाला काय करायचे आहे?',
  outOf1000: '1000 पैकी',
  lockedFundsLoans: 'लॉक (सक्रिय कर्जांमध्ये)',
  lockedFundsInvestments: 'लॉक (गुंतवणुकांमध्ये)',
  addFundsHint: 'तुमच्या वॉलेटमध्ये पैसे जोडा',
  borrowerLabel: 'कर्जदार',
  lenderLabel: 'कर्जदाता',
);

// ─── Accessor ─────────────────────────────────────────────────────────────────

class AppL10n {
  static AppStrings of(BuildContext context) {
    final code =
        Provider.of<LanguageProvider>(context, listen: false).languageCode;
    return _forCode(code);
  }

  static AppStrings forCode(String code) => _forCode(code);

  static AppStrings _forCode(String code) {
    switch (code) {
      case kLangHi:
        return _hi;
      case kLangMr:
        return _mr;
      default:
        return _en;
    }
  }
}

export interface UILabels {
  // Conversation detail page
  audio: string;
  recorded: string;
  uploaded: string;
  internalSummary: string;
  clientSummary: string;
  keyTopics: string;
  decisions: string;
  actionItems: string;
  objections: string;
  followUpPromises: string;
  openQuestions: string;
  internalNotes: string;
  followUpEmail: string;
  emailSubject: string;
  aiChat: string;
  askAbout: string;
  send: string;
  noMessages: string;
  thinking: string;
  analyze: string;
  reanalyze: string;
  analyzing: string;
  retryAnalysis: string;
  back: string;
  createdOn: string;
  by: string;
  noneIdentified: string;
  summaryPlaceholder: string;
  topicsPlaceholder: string;
  actionsPlaceholder: string;
  chatPlaceholder: string;
  processingMessage: string;
  uploadToAnalyze: string;
  chooseFile: string;
  addInstructions: string;
  hideInstructions: string;
  instructionsPlaceholder: string;
  analysisTip: string;
  insufficientContent: string;
  customSummaryTitle: string;

  // Navigation & layout
  navConversations: string;
  navSettings: string;
  signOut: string;

  // Dashboard
  conversations: string;
  conversationCount: string;
  inWorkspace: string;
  newConversation: string;
  noConversationsYet: string;
  noConversationsDesc: string;
  createFirstConversation: string;
  freePlan: string;
  memberCount: string;
  upgradeToPro: string;
  comingSoon: string;
  conversationsUsage: string;
  audioMinutes: string;
  aiQueries: string;

  // Conversation list / search
  all: string;
  completed: string;
  draft: string;
  processing: string;
  failed: string;
  searchConversations: string;
  noSearchResults: string;

  // New conversation
  newConversationTitle: string;
  titleLabel: string;
  titlePlaceholder: string;
  recordAudio: string;
  useYourMicrophone: string;
  uploadFile: string;
  supportedFormats: string;
  chooseDifferentMethod: string;
  creatingConversation: string;
  createConversation: string;
  enterTitle: string;
  recordOrUpload: string;
  failedToCreate: string;
  failedToUpload: string;
  somethingWentWrong: string;

  // Auth
  welcomeBack: string;
  signInToWorkspace: string;
  accountCreated: string;
  emailLabel: string;
  passwordLabel: string;
  signingIn: string;
  signIn: string;
  noAccount: string;
  createAccount: string;
  createYourAccount: string;
  startSummarizing: string;
  fullNameLabel: string;
  minPassword: string;
  creatingAccount: string;
  alreadyHaveAccount: string;
  invalidCredentials: string;
  registrationFailed: string;

  // Landing page
  poweredByGemini: string;
  heroTitle1: string;
  heroTitle2: string;
  heroDesc: string;
  startForFree: string;
  iHaveAccount: string;
  featureRecording: string;
  featureUpload: string;
  featureAnalysis: string;
  featureChat: string;
  featureEmail: string;

  // Settings
  workspaceSettings: string;
  workspaceName: string;
  defaultLanguage: string;
  defaultLanguageDesc: string;
  customInstructions: string;
  customInstructionsDesc: string;
  styleLearnTitle: string;
  styleLearnDesc: string;
  save: string;
  saving: string;
  saved: string;
  failedToSave: string;
  onlyOwnersAdmins: string;
  instructionsSettingsPlaceholder: string;

  // Style examples
  pending: string;
  analyzed: string;
  exampleTitle: string;
  exampleTitlePlaceholder: string;
  audioFile: string;
  emailSubjectSent: string;
  emailSubjectPlaceholder: string;
  emailBodySent: string;
  emailBodyPlaceholder: string;
  notesOptional: string;
  notesPlaceholder: string;
  uploading: string;
  addExample: string;
  cancel: string;
  addStyleExample: string;
  generating: string;
  generateStyleProfile: string;
  activeStyleProfile: string;
  summaryStyle: string;
  tone: string;
  emailFormality: string;
  emailLength: string;
  structure: string;
  directness: string;
  focusAreas: string;
  basedOnExamples: string;
  noExamplesYet: string;
  deleteExample: string;
  processingFailed: string;
  generationFailed: string;
  allFieldsRequired: string;
  uploadFailed: string;
  loading: string;

  // Delete
  deleteConversation: string;
  confirmDelete: string;
  yes: string;
  deleteFailed: string;

  // Audio recorder
  recordAudioTitle: string;
  startRecording: string;
  recording: string;
  stop: string;
  recordingComplete: string;
  recordAgain: string;
  micDenied: string;
  micNotFound: string;
  micInUse: string;
  micError: string;
  requestingMic: string;
  pause: string;
  recordingPaused: string;
  resume: string;
  tryAgain: string;

  // Source picker
  sourceMicTitle: string;
  sourceMicDesc: string;
  sourceScreenTitle: string;
  sourceScreenDesc: string;
  sourceBothTitle: string;
  sourceBothDesc: string;
  screenAudioHint: string;
  requestingScreen: string;
  recordingScreen: string;
  recordingBoth: string;
  screenDenied: string;
  noSystemAudio: string;

  // Mic permission denied guide
  micDeniedTitle: string;
  micDeniedExplain: string;
  micDeniedStep1: string;
  micDeniedStep1b: string;
  micDeniedStep2: string;
  micDeniedStep3: string;
  micDeniedRetry: string;

  // Meet guide
  meetGuideTitleBoth: string;
  meetGuideTitleScreen: string;
  meetStep1: string;
  meetStep2: string;
  meetStep3: string;
  meetStep4: string;
  meetStep5: string;
  meetStep5Screen: string;
  meetAudioWarning: string;
  meetStartBtn: string;

  // MP3 export
  downloadMp3: string;
  convertingMp3: string;
  mp3Failed: string;

  // File upload
  uploadAudioFile: string;
  clickToSelect: string;
  supportedFormatsLong: string;
  change: string;
  fileTooLarge: string;

  // Draft upload
  uploadToAnalyzeAction: string;

  // Editable title
  clickToEditTitle: string;
}

const LABELS: Record<string, UILabels> = {
  Hebrew: {
    // Conversation detail
    audio: "שמע",
    recorded: "הוקלט",
    uploaded: "הועלה",
    internalSummary: "סיכום פנימי",
    clientSummary: "סיכום ידידותי ללקוח",
    keyTopics: "נושאים מרכזיים",
    decisions: "החלטות",
    actionItems: "פריטי פעולה",
    objections: "התנגדויות לקוחות",
    followUpPromises: "הבטחות מעקב",
    openQuestions: "שאלות פתוחות",
    internalNotes: "הערות פנימיות (נא לא לשתף)",
    followUpEmail: 'דוא"ל מעקב מומלץ',
    emailSubject: "נושא:",
    aiChat: "צ'אט AI",
    askAbout: "שאל שאלה על השיחה...",
    send: "שלח",
    noMessages: "אין הודעות עדיין. שאל שאלה על השיחה.",
    thinking: "חושב...",
    analyze: "נתח שיחה",
    reanalyze: "נתח מחדש",
    analyzing: "מנתח עם AI...",
    retryAnalysis: "נסה שוב",
    back: "חזרה לשיחות",
    createdOn: "נוצר ב-",
    by: " על ידי ",
    noneIdentified: "לא זוהו.",
    summaryPlaceholder: "סיכום AI יופיע כאן לאחר הניתוח.",
    topicsPlaceholder: "נושאים שזוהו יופיעו כאן.",
    actionsPlaceholder: "פריטי פעולה יופיעו כאן.",
    chatPlaceholder: "הצ'אט יהיה זמין לאחר ניתוח השיחה.",
    processingMessage: "מנתח שיחה... זה עשוי לקחת דקה. רענן את הדף לבדיקת תוצאות.",
    uploadToAnalyze: "להפעלת הניתוח, יש להעלות קובץ אודיו",
    chooseFile: "בחר קובץ",
    addInstructions: "הוסף הוראות לניתוח זה",
    hideInstructions: "הסתר הוראות",
    instructionsPlaceholder: "לדוגמה: זו פגישת מכירה ראשונית. שים לב במיוחד לתקציב שהלקוח ציין.",
    analysisTip: "הניתוח עשוי לקחת דקה בהתאם לאורך האודיו.",
    insufficientContent: "תוכן לא מספיק לניתוח",
    customSummaryTitle: "ניתוח מותאם אישית",

    // Navigation
    navConversations: "שיחות",
    navSettings: "הגדרות",
    signOut: "התנתק",

    // Dashboard
    conversations: "שיחות",
    conversationCount: "שיחות",
    inWorkspace: "ב-",
    newConversation: "+ שיחה חדשה",
    noConversationsYet: "אין שיחות עדיין",
    noConversationsDesc: "העלה או הקלט שיחה עסקית כדי לקבל סיכום בינה מלאכותית.",
    createFirstConversation: "צור את השיחה הראשונה שלך",
    freePlan: "תוכנית חינמית",
    memberCount: "חברים ב-workspace זה",
    upgradeToPro: "שדרג ל-Pro",
    comingSoon: "בקרוב",
    conversationsUsage: "שיחות",
    audioMinutes: "דקות אודיו",
    aiQueries: "שאילתות AI",

    // Conversation list
    all: "הכל",
    completed: "הושלמו",
    draft: "טיוטות",
    processing: "בעיבוד",
    failed: "נכשלו",
    searchConversations: "חפש שיחות...",
    noSearchResults: "אין שיחות שתואמות את החיפוש.",

    // New conversation
    newConversationTitle: "שיחה חדשה",
    titleLabel: "כותרת",
    titlePlaceholder: "לדוגמה, סטנדאפ צוות שבועי",
    recordAudio: "הקלט אודיו",
    useYourMicrophone: "השתמש במיקרופון שלך",
    uploadFile: "העלה קובץ",
    supportedFormats: "MP3, WAV, M4A, WebM, OGG",
    chooseDifferentMethod: "בחר שיטה אחרת",
    creatingConversation: "יוצר שיחה...",
    createConversation: "צור שיחה",
    enterTitle: "נא להזין כותרת לשיחה.",
    recordOrUpload: "נא להקליט או להעלות קובץ אודיו.",
    failedToCreate: "יצירת השיחה נכשלה",
    failedToUpload: "העלאת האודיו נכשלה",
    somethingWentWrong: "משהו השתבש. נסה שוב.",

    // Auth
    welcomeBack: "ברוך שובך",
    signInToWorkspace: "התחבר ל-workspace שלך",
    accountCreated: "החשבון נוצר בהצלחה. נא להתחבר.",
    emailLabel: "אימייל",
    passwordLabel: "סיסמה",
    signingIn: "מתחבר...",
    signIn: "התחבר",
    noAccount: "אין לך חשבון?",
    createAccount: "צור חשבון",
    createYourAccount: "צור את החשבון שלך",
    startSummarizing: "התחל לסכם את הפגישות שלך עם AI.",
    fullNameLabel: "שם מלא",
    minPassword: "מינימום 8 תווים",
    creatingAccount: "יוצר חשבון...",
    alreadyHaveAccount: "כבר יש לך חשבון?",
    invalidCredentials: "אימייל או סיסמה לא תקינים",
    registrationFailed: "ההרשמה נכשלה",

    // Landing page
    poweredByGemini: "מופעל על ידי Gemini AI",
    heroTitle1: "הפגישות שלך,",
    heroTitle2: "מסוכמות בצורה מבריקה",
    heroDesc: "הקלט או העלה כל שיחה עסקית. קבל סיכומים מיידיים מונעי AI, פריטי פעולה וטיוטות מעקב. ואז שוחח עם הפגישות שלך.",
    startForFree: "התחל בחינם",
    iHaveAccount: "יש לי חשבון",
    featureRecording: "הקלטה בדפדפן",
    featureUpload: "העלאת אודיו",
    featureAnalysis: "ניתוח AI",
    featureChat: "שיחה עם פגישות",
    featureEmail: 'אימיילי מעקב אוטומטיים',

    // Settings
    workspaceSettings: "הגדרות Workspace",
    workspaceName: "שם Workspace",
    defaultLanguage: "שפת ברירת מחדל לפלט AI",
    defaultLanguageDesc: "כל סיכומי ה-AI ותגובות הצ'אט ייווצרו בשפה זו כברירת מחדל. ניתן לשנות לכל שיחה.",
    customInstructions: "הוראות AI מותאמות אישית",
    customInstructionsDesc: "הוראות אלו ייכללו בכל ניתוח AI בכל השיחות. השתמש בזה כדי לספק הקשר על העסק שלך.",
    styleLearnTitle: "למידת סגנון תקשורת",
    styleLearnDesc: "העלה הקלטות שיחות קודמות יחד עם האימייל שנשלח. ה-AI ילמד את סגנון הכתיבה שלך ויחיל אותו על סיכומים וטיוטות אימייל עתידיים.",
    save: "שמור",
    saving: "שומר...",
    saved: "נשמר",
    failedToSave: "השמירה נכשלה",
    onlyOwnersAdmins: "רק בעלים ומנהלים יכולים לשנות הגדרה זו.",
    instructionsSettingsPlaceholder: "לדוגמה: אני יועץ עסקי. תמיד התייחס ללקוחות שלי כ'שותפים'. דגש מיוחד על משימות מעקב.",

    // Style examples
    pending: "ממתין",
    analyzed: "נותח",
    exampleTitle: "כותרת הדוגמה",
    exampleTitlePlaceholder: "לדוגמה, שיחת מכירה עם חברת אקמה",
    audioFile: "קובץ אודיו",
    emailSubjectSent: "נושא האימייל ששלחת",
    emailSubjectPlaceholder: "מענה: מעקב לפגישה שלנו",
    emailBodySent: "גוף האימייל ששלחת",
    emailBodyPlaceholder: "הדבק את האימייל שנשלח לאחר שיחה זו...",
    notesOptional: "הערות (אופציונלי)",
    notesPlaceholder: "הקשר כלשהו על שיחה זו",
    uploading: "מעלה...",
    addExample: "הוסף דוגמה",
    cancel: "ביטול",
    addStyleExample: "+ הוסף דוגמת סגנון",
    generating: "מייצר...",
    generateStyleProfile: "צור פרופיל סגנון",
    activeStyleProfile: "פרופיל סגנון פעיל",
    summaryStyle: "סגנון סיכום:",
    tone: "טון:",
    emailFormality: "פורמליות אימייל:",
    emailLength: "אורך אימייל:",
    structure: "מבנה:",
    directness: "ישירות:",
    focusAreas: "תחומי מיקוד:",
    basedOnExamples: "מבוסס על דוגמאות שנותחו",
    noExamplesYet: "אין דוגמאות סגנון עדיין. הוסף שיחה קודמת + האימייל שנשלח אחריה כדי ללמד את ה-AI את הסגנון שלך.",
    deleteExample: "מחק",
    processingFailed: "העיבוד נכשל",
    generationFailed: "היצירה נכשלה",
    allFieldsRequired: "כל השדות נדרשים.",
    uploadFailed: "ההעלאה נכשלה",
    loading: "טוען...",

    // Delete
    deleteConversation: "מחק שיחה",
    confirmDelete: "האם אתה בטוח שברצונך למחוק שיחה זו? פעולה זו אינה הפיכה.",
    yes: "כן",
    deleteFailed: "מחיקה נכשלה. נסה שוב.",

    // Audio recorder
    recordAudioTitle: "הקלטת אודיו",
    startRecording: "התחל הקלטה",
    recording: "מקליט",
    stop: "עצור",
    recordingComplete: "ההקלטה הושלמה",
    recordAgain: "הקלט שוב",
    micDenied: "הגישה למיקרופון נדחתה. אנא אפשר גישה בהגדרות הדפדפן.",
    micNotFound: "לא נמצא מיקרופון. חבר מיקרופון ונסה שוב.",
    micInUse: "המיקרופון בשימוש על ידי אפליקציה אחרת.",
    micError: "לא ניתן להתחיל הקלטה. בדוק את המיקרופון שלך.",
    requestingMic: "מבקש גישה למיקרופון...",
    pause: "השהה",
    recordingPaused: "מושהה",
    resume: "המשך",
    tryAgain: "נסה שוב",

    // Source picker
    sourceMicTitle: "מיקרופון בלבד",
    sourceMicDesc: "הקלטת הקול שלך בלבד (לתזכיר אישי וכו׳)",
    sourceScreenTitle: "פגישה על המחשב",
    sourceScreenDesc: "שתף טאב/חלון של Zoom, Meet או Teams — נקלט כולל אודיו של כל המשתתפים",
    sourceBothTitle: "פגישה + המיקרופון שלך",
    sourceBothDesc: "אודיו מערכת + הקול שלך יחד — הכי טוב להקלטת פגישות שאתה משתתף בהן",
    screenAudioHint: "לפגישות: סמן “שתף אודיו מהטאב” בדיאלוג של הדפדפן. זמין ב-Chrome / Edge.",
    requestingScreen: "מבקש גישה למסך...",
    recordingScreen: "מקליט פגישה",
    recordingBoth: "מקליט פגישה + מיקרופון",
    screenDenied: "גישת שיתוף מסך נדחתה או בוטלה.",
    noSystemAudio: 'לא נמצא אודיו. סמן “שתף אודיו מהטאב” בדיאלוג השיתוף ונסה שוב.',

    // Mic permission denied guide
    micDeniedTitle: 'הגישה למיקרופון חסומה',
    micDeniedExplain: 'הדפדפן חסם גישה למיקרופון. כך מאפשרים אותה ב-Chrome:',
    micDeniedStep1: 'לחצי על המנעול',
    micDeniedStep1b: 'בסרגל הכתובת (ליד כתובת האתר)',
    micDeniedStep2: 'בחרי “הגדרות אתר” ← מצאי “מיקרופון” ← שני ל-”אפשר”',
    micDeniedStep3: 'חזרי לכאן ולחצי “נסה שוב” — ההקלטה תתחיל מיד',
    micDeniedRetry: 'נסה שוב — אישרתי גישה למיקרופון',

    // Meet guide
    meetGuideTitleBoth: 'איך להקליט פגישה + המיקרופון שלך',
    meetGuideTitleScreen: 'איך להקליט פגישה',
    meetStep1: 'היכנסי לפגישה (Meet, Zoom, Teams וכו\') בטאב נפרד',
    meetStep2: 'לחצי “התחל” — יפתח דיאלוג שיתוף מסך',
    meetStep3: 'בחרי “טאב” (Tab) ובחרי את טאב הפגישה',
    meetStep4: '\u2705 סמני “שתף אודיו מהטאב” — חובה!',
    meetStep5: 'לחצי “שתף”, ואז אפשרי גישה למיקרופון',
    meetStep5Screen: 'לחצי “שתף”',
    meetAudioWarning: '\u26a0\ufe0f Chrome / Edge בלבד — Safari לא תומך. אם אין אופציית “שתף אודיו”, בחרי “טאב” ולא “חלון”.',
    meetStartBtn: 'הבנתי — התחל שיתוף מסך',

    // MP3 export
    downloadMp3: 'הורד כ-MP3',
    convertingMp3: "ממיר ל-MP3...",
    mp3Failed: "המרה ל-MP3 נכשלה. נסה שוב.",

    // File upload
    uploadAudioFile: "העלאת קובץ אודיו",
    clickToSelect: "לחץ לבחירת קובץ אודיו",
    supportedFormatsLong: "MP3, WAV, M4A, WebM, OGG — עד 100MB",
    change: "שנה",
    fileTooLarge: "הקובץ גדול מדי. גודל מקסימלי 100MB.",

    // Draft upload
    uploadToAnalyzeAction: "העלה אודיו לניתוח",

    // Editable title
    clickToEditTitle: "לחץ לעריכת כותרת",
  },

  English: {
    // Conversation detail
    audio: "Audio",
    recorded: "Recorded",
    uploaded: "Uploaded",
    internalSummary: "Internal Summary",
    clientSummary: "Client-Friendly Summary",
    keyTopics: "Key Topics",
    decisions: "Decisions",
    actionItems: "Action Items",
    objections: "Customer Objections",
    followUpPromises: "Follow-Up Promises",
    openQuestions: "Open Questions",
    internalNotes: "Internal Notes (Do Not Share)",
    followUpEmail: "Suggested Follow-Up Email",
    emailSubject: "Subject:",
    aiChat: "AI Chat",
    askAbout: "Ask about this conversation...",
    send: "Send",
    noMessages: "No messages yet. Ask a question about this conversation.",
    thinking: "Thinking...",
    analyze: "Analyze Conversation",
    reanalyze: "Reanalyze",
    analyzing: "Analyzing with AI...",
    retryAnalysis: "Retry Analysis",
    back: "Back to conversations",
    createdOn: "Created on ",
    by: " by ",
    noneIdentified: "None identified.",
    summaryPlaceholder: "AI summary will appear here after processing.",
    topicsPlaceholder: "Extracted topics will appear here.",
    actionsPlaceholder: "Action items will appear here.",
    chatPlaceholder: "Chat will be available after the conversation is analyzed.",
    processingMessage: "Analyzing conversation... This may take a minute. Refresh to check results.",
    uploadToAnalyze: "Upload an audio file to start analysis",
    chooseFile: "Choose file",
    addInstructions: "Add instructions for this analysis",
    hideInstructions: "Hide instructions",
    instructionsPlaceholder: "e.g. This is a first sales meeting. Pay special attention to the budget the client mentioned.",
    analysisTip: "Analysis may take a minute depending on audio length.",
    insufficientContent: "Insufficient Content for Analysis",
    customSummaryTitle: "Custom Analysis",

    // Navigation
    navConversations: "Conversations",
    navSettings: "Settings",
    signOut: "Sign out",

    // Dashboard
    conversations: "Conversations",
    conversationCount: "conversations",
    inWorkspace: "in ",
    newConversation: "+ New Conversation",
    noConversationsYet: "No conversations yet",
    noConversationsDesc: "Upload or record a meeting conversation to get an AI-powered summary.",
    createFirstConversation: "Create your first conversation",
    freePlan: "Free Plan",
    memberCount: "members in this workspace",
    upgradeToPro: "Upgrade to Pro",
    comingSoon: "Coming soon",
    conversationsUsage: "Conversations",
    audioMinutes: "Audio minutes",
    aiQueries: "AI queries",

    // Conversation list
    all: "All",
    completed: "Completed",
    draft: "Draft",
    processing: "Processing",
    failed: "Failed",
    searchConversations: "Search conversations...",
    noSearchResults: "No conversations match your search.",

    // New conversation
    newConversationTitle: "New Conversation",
    titleLabel: "Title",
    titlePlaceholder: "e.g., Weekly team standup",
    recordAudio: "Record Audio",
    useYourMicrophone: "Use your microphone",
    uploadFile: "Upload File",
    supportedFormats: "MP3, WAV, M4A, WebM, OGG",
    chooseDifferentMethod: "Choose different method",
    creatingConversation: "Creating conversation...",
    createConversation: "Create Conversation",
    enterTitle: "Please enter a conversation title.",
    recordOrUpload: "Please record or upload an audio file.",
    failedToCreate: "Failed to create conversation",
    failedToUpload: "Failed to upload audio",
    somethingWentWrong: "Something went wrong. Please try again.",

    // Auth
    welcomeBack: "Welcome back",
    signInToWorkspace: "Sign in to your workspace",
    accountCreated: "Account created successfully. Please sign in.",
    emailLabel: "Email",
    passwordLabel: "Password",
    signingIn: "Signing in...",
    signIn: "Sign in",
    noAccount: "Don't have an account?",
    createAccount: "Create account",
    createYourAccount: "Create your account",
    startSummarizing: "Start summarizing your meetings with AI.",
    fullNameLabel: "Full name",
    minPassword: "Minimum 8 characters",
    creatingAccount: "Creating account...",
    alreadyHaveAccount: "Already have an account?",
    invalidCredentials: "Invalid email or password",
    registrationFailed: "Registration failed",

    // Landing page
    poweredByGemini: "Powered by Gemini AI",
    heroTitle1: "Your meetings,",
    heroTitle2: "brilliantly summarized",
    heroDesc: "Record or upload any business conversation. Get instant AI-powered summaries, action items, and follow-up drafts. Then chat with your meetings.",
    startForFree: "Start for free",
    iHaveAccount: "I have an account",
    featureRecording: "Browser recording",
    featureUpload: "Upload audio",
    featureAnalysis: "AI analysis",
    featureChat: "Chat with meetings",
    featureEmail: "Auto follow-up emails",

    // Settings
    workspaceSettings: "Workspace Settings",
    workspaceName: "Workspace Name",
    defaultLanguage: "Default AI Output Language",
    defaultLanguageDesc: "All AI summaries and chat responses will be generated in this language by default. You can override per conversation.",
    customInstructions: "Custom AI Instructions",
    customInstructionsDesc: "These instructions will be included in every AI analysis across all conversations. Use this to provide context about your business.",
    styleLearnTitle: "Communication Style Learning",
    styleLearnDesc: "Upload past conversation recordings together with the follow-up email you sent. The AI will learn your writing style and apply it to future summaries and email drafts.",
    save: "Save",
    saving: "Saving...",
    saved: "Saved",
    failedToSave: "Failed to save",
    onlyOwnersAdmins: "Only workspace owners and admins can change this setting.",
    instructionsSettingsPlaceholder: "e.g. I'm a business consultant. Always refer to my clients as 'partners'. Focus on follow-up tasks.",

    // Style examples
    pending: "Pending",
    analyzed: "Analyzed",
    exampleTitle: "Example title",
    exampleTitlePlaceholder: "e.g. Sales call with Acme Corp",
    audioFile: "Audio file",
    emailSubjectSent: "Email subject you sent",
    emailSubjectPlaceholder: "Re: Follow-up from our meeting",
    emailBodySent: "Email body you sent",
    emailBodyPlaceholder: "Paste the actual email you sent after this conversation...",
    notesOptional: "Notes (optional)",
    notesPlaceholder: "Any context about this conversation",
    uploading: "Uploading...",
    addExample: "Add Example",
    cancel: "Cancel",
    addStyleExample: "+ Add Style Example",
    generating: "Generating...",
    generateStyleProfile: "Generate Style Profile",
    activeStyleProfile: "Active Style Profile",
    summaryStyle: "Summary style:",
    tone: "Tone:",
    emailFormality: "Email formality:",
    emailLength: "Email length:",
    structure: "Structure:",
    directness: "Directness:",
    focusAreas: "Focus areas:",
    basedOnExamples: "Based on analyzed examples",
    noExamplesYet: "No style examples yet. Add a past conversation + the email you sent afterward to teach the AI your style.",
    deleteExample: "Delete",
    processingFailed: "Processing failed",
    generationFailed: "Generation failed",
    allFieldsRequired: "All fields are required.",
    uploadFailed: "Upload failed",
    loading: "Loading...",

    // Delete
    deleteConversation: "Delete",
    confirmDelete: "Are you sure you want to delete this conversation? This action cannot be undone.",
    yes: "Yes",
    deleteFailed: "Delete failed. Please try again.",

    // Audio recorder
    recordAudioTitle: "Record Audio",
    startRecording: "Start Recording",
    recording: "Recording",
    stop: "Stop",
    recordingComplete: "Recording complete",
    recordAgain: "Record again",
    micDenied: "Microphone access denied. Please allow access in your browser settings.",
    micNotFound: "No microphone found. Connect a microphone and try again.",
    micInUse: "Microphone is in use by another application.",
    micError: "Could not start recording. Check your microphone.",
    requestingMic: "Requesting microphone access...",
    pause: "Pause",
    recordingPaused: "Paused",
    resume: "Resume",
    tryAgain: "Try again",

    // Source picker
    sourceMicTitle: "Microphone only",
    sourceMicDesc: "Record just your voice (memos, notes, etc.)",
    sourceScreenTitle: "Live meeting on this computer",
    sourceScreenDesc: "Share a Zoom, Meet, or Teams tab/window — captures all participants",
    sourceBothTitle: "Meeting + your microphone",
    sourceBothDesc: "System audio mixed with your mic — best for meetings you're actively in",
    screenAudioHint: "Meetings: in the share dialog, tick \"Share tab audio\". Works in Chrome / Edge.",
    requestingScreen: "Requesting screen access...",
    recordingScreen: "Recording meeting",
    recordingBoth: "Recording meeting + mic",
    screenDenied: "Screen share was denied or cancelled.",
    noSystemAudio: "No audio captured. Tick \"Share tab audio\" in the share dialog and try again.",

    // Mic permission denied guide
    micDeniedTitle: 'Microphone access is blocked',
    micDeniedExplain: 'Your browser blocked microphone access. To fix it in Chrome:',
    micDeniedStep1: 'Click the lock icon',
    micDeniedStep1b: 'in the address bar (left of the URL)',
    micDeniedStep2: 'Go to "Site settings" \u2192 find "Microphone" \u2192 change to "Allow"',
    micDeniedStep3: 'Come back here and click "Try again" \u2014 recording will start immediately',
    micDeniedRetry: 'Try again \u2014 I allowed microphone access',

    // Meet guide
    meetGuideTitleBoth: 'How to record a meeting + your microphone',
    meetGuideTitleScreen: 'How to record a meeting',
    meetStep1: 'Join your meeting (Meet, Zoom, Teams, etc.) in a separate tab',
    meetStep2: 'Click "Start" \u2014 a screen share dialog will open',
    meetStep3: 'Choose "Tab" and select your meeting tab',
    meetStep4: '\u2705 Check "Share tab audio" \u2014 this is required!',
    meetStep5: 'Click "Share", then allow microphone access',
    meetStep5Screen: 'Click "Share"',
    meetAudioWarning: '\u26a0\ufe0f Chrome / Edge only \u2014 Safari doesn\'t support tab audio. If "Share audio" is missing, select "Tab" not "Window".',
    meetStartBtn: 'Got it \u2014 start screen share',

    // MP3 export
    downloadMp3: 'Download as MP3',
    convertingMp3: "Converting to MP3...",
    mp3Failed: "MP3 conversion failed. Please try again.",

    // File upload
    uploadAudioFile: "Upload Audio File",
    clickToSelect: "Click to select an audio file",
    supportedFormatsLong: "MP3, WAV, M4A, WebM, OGG — up to 100MB",
    change: "Change",
    fileTooLarge: "File too large. Maximum size is 100MB.",

    // Draft upload
    uploadToAnalyzeAction: "Upload audio to analyze",

    // Editable title
    clickToEditTitle: "Click to edit title",
  },

  Yiddish: {
    // Conversation detail
    audio: "אַודיאָ",
    recorded: "אויפגענומען",
    uploaded: "אַרויפֿגעלאָדן",
    internalSummary: "אינערלעכע סיכום",
    clientSummary: "קליענט-פֿרײַנדלעכע סיכום",
    keyTopics: "וויכטיקע טעמעס",
    decisions: "באַשלוסן",
    actionItems: "אַקציע פּונקטן",
    objections: "קליענט איינווענדונגען",
    followUpPromises: "נאָכפֿאָלג הבטחות",
    openQuestions: "אָפֿענע פֿראַגן",
    internalNotes: "אינערלעכע באַמערקונגען (נישט טיילן)",
    followUpEmail: "פֿאָרגעשלאָגענער נאָכפֿאָלג בריוו",
    emailSubject: "נושא:",
    aiChat: "AI שמועס",
    askAbout: "פֿרעג אַ פֿראַגע וועגן דעם שמועס...",
    send: "שיקן",
    noMessages: "קיין הודעות נאָך. פֿרעג אַ פֿראַגע.",
    thinking: "טראַכט...",
    analyze: "אַנאַליזירן שמועס",
    reanalyze: "אַנאַליזירן נאָכאַמאָל",
    analyzing: "אַנאַליזירן מיט AI...",
    retryAnalysis: "פּרובירן נאָכאַמאָל",
    back: "צוריק צו שמועסן",
    createdOn: "באַשאַפֿן אויף ",
    by: " דורך ",
    noneIdentified: "נישט געפֿונען.",
    summaryPlaceholder: "AI סיכום וועט אויפֿטרעטן נאָך פֿאַרארבעטונג.",
    topicsPlaceholder: "געפֿונענע טעמעס וועלן אויפֿטרעטן דאָ.",
    actionsPlaceholder: "אַקציע פּונקטן וועלן אויפֿטרעטן דאָ.",
    chatPlaceholder: "שמועס וועט זײַן צוגענגלעך נאָכן אַנאַליז.",
    processingMessage: "אַנאַליזירן שמועס... דאָס קען נעמען אַ מינוט.",
    uploadToAnalyze: "לאָדט אַרויף אַן אַודיאָ טעקע צו אָנהייבן",
    chooseFile: "קלויבט טעקע",
    addInstructions: "צוגעבן אָנווײַזונגען",
    hideInstructions: "באַהאַלטן אָנווײַזונגען",
    instructionsPlaceholder: "לדוגמה: דאָס איז אַ ערשטע פֿאַרקויף באַגעגעניש.",
    analysisTip: "אַנאַליז קען נעמען אַ מינוט.",
    insufficientContent: "נישט גענוג אינהאַלט פֿאַר אַנאַליז",
    customSummaryTitle: "מותאם אישית אַנאַליז",

    // Navigation
    navConversations: "שמועסן",
    navSettings: "אײַנשטעלונגען",
    signOut: "אַרויסגיין",

    // Dashboard
    conversations: "שמועסן",
    conversationCount: "שמועסן",
    inWorkspace: "אין ",
    newConversation: "+ נײַע שמועס",
    noConversationsYet: "קיין שמועסן נאָך",
    noConversationsDesc: "לאָדט אַרויף אָדער רעקאָרדירט אַ שמועס צו באַקומען אַ AI סיכום.",
    createFirstConversation: "שאַפֿט אײַער ערשטע שמועס",
    freePlan: "פֿרײַ פּלאַן",
    memberCount: "מיטגלידער אין דעם workspace",
    upgradeToPro: "אַפּגרעידן צו Pro",
    comingSoon: "קומט באַלד",
    conversationsUsage: "שמועסן",
    audioMinutes: "אַודיאָ מינוטן",
    aiQueries: "AI פֿראַגן",

    // Conversation list
    all: "אַלע",
    completed: "פֿאַרענדיקט",
    draft: "טיוטות",
    processing: "פֿאַרארבעט",
    failed: "דורכגעפֿאַלן",
    searchConversations: "זוך שמועסן...",
    noSearchResults: "קיין שמועסן געפֿונען.",

    // New conversation
    newConversationTitle: "נײַע שמועס",
    titleLabel: "טיטל",
    titlePlaceholder: "למשל, וואָכנטלעכע צוזאַמענקונפֿט",
    recordAudio: "רעקאָרדירן אַודיאָ",
    useYourMicrophone: "נוצט אײַער מיקראָפֿאָן",
    uploadFile: "אַרויפֿלאָדן טעקע",
    supportedFormats: "MP3, WAV, M4A, WebM, OGG",
    chooseDifferentMethod: "קלויבט אַן אַנדער מעטאָד",
    creatingConversation: "שאַפֿט שמועס...",
    createConversation: "שאַפֿט שמועס",
    enterTitle: "ביטע אַרײַנגעבן אַ טיטל.",
    recordOrUpload: "ביטע רעקאָרדירן אָדער אַרויפֿלאָדן אַ אַודיאָ טעקע.",
    failedToCreate: "שאַפֿן שמועס דורכגעפֿאַלן",
    failedToUpload: "אַרויפֿלאָדן דורכגעפֿאַלן",
    somethingWentWrong: "עפּעס איז שיף געגאַנגען. פּרובירט נאָכאַמאָל.",

    // Auth
    welcomeBack: "ברוך הבא צוריק",
    signInToWorkspace: "אַרײַנגיין אין אײַער workspace",
    accountCreated: "חשבון באַשאַפֿן מיט הצלחה. ביטע אַרײַנגיין.",
    emailLabel: "אימעיל",
    passwordLabel: "פּאַסוואָרט",
    signingIn: "אַרײַנגיין...",
    signIn: "אַרײַנגיין",
    noAccount: "האָט נישט קיין חשבון?",
    createAccount: "שאַפֿט חשבון",
    createYourAccount: "שאַפֿט אײַער חשבון",
    startSummarizing: "אָנהייבן סיכום פֿון אײַערע באַגעגענישן מיט AI.",
    fullNameLabel: "פֿולער נאָמען",
    minPassword: "מינימום 8 אותיות",
    creatingAccount: "שאַפֿט חשבון...",
    alreadyHaveAccount: "שוין האָט אַ חשבון?",
    invalidCredentials: "אומגילטיק אימעיל אָדער פּאַסוואָרט",
    registrationFailed: "רעגיסטראַציע דורכגעפֿאַלן",

    // Landing page
    poweredByGemini: "באַטריבן דורך Gemini AI",
    heroTitle1: "אײַערע באַגעגענישן,",
    heroTitle2: "בריליאַנט סיכומירט",
    heroDesc: "רעקאָרדירט אָדער לאָדט אַרויף אַ געשעפֿט שמועס. באַקומט מיידיק AI סיכומים, אַקציע פּונקטן, און נאָכפֿאָלג בריוון.",
    startForFree: "אָנהייבן פֿרײַ",
    iHaveAccount: "איך האָב אַ חשבון",
    featureRecording: "בלעטערער רעקאָרדירונג",
    featureUpload: "אַרויפֿלאָדן אַודיאָ",
    featureAnalysis: "AI אַנאַליז",
    featureChat: "שמועסן מיט באַגעגענישן",
    featureEmail: "אויטאָמאַטישע נאָכפֿאָלג אימעילס",

    // Settings
    workspaceSettings: "Workspace אײַנשטעלונגען",
    workspaceName: "Workspace נאָמען",
    defaultLanguage: "ברירת מחדל AI שפּראַך",
    defaultLanguageDesc: "אַלע AI סיכומים וועלן באַשאַפֿן ווערן אין דער שפּראַך.",
    customInstructions: "מותאם אישית AI אָנווײַזונגען",
    customInstructionsDesc: "די אָנווײַזונגען וועלן ווערן אײַנגעשלאָסן אין יעדן AI אַנאַליז.",
    styleLearnTitle: "לערנען קאָמוניקאַציע סגנון",
    styleLearnDesc: "לאָדט אַרויף שמועס הקלטות מיטן אימעיל וואָס איר האָט געשיקט.",
    save: "אויפֿהיטן",
    saving: "היט אויף...",
    saved: "אויפֿגעהיט",
    failedToSave: "אויפֿהיטן דורכגעפֿאַלן",
    onlyOwnersAdmins: "נאָר בעלים און מנהלים קענען ענדערן.",
    instructionsSettingsPlaceholder: "למשל: איך בין אַ געשעפֿט יועץ.",

    // Style examples
    pending: "וואַרטנדיק",
    analyzed: "אַנאַליזירט",
    exampleTitle: "דוגמה טיטל",
    exampleTitlePlaceholder: "למשל, פֿאַרקויף שמועס",
    audioFile: "אַודיאָ טעקע",
    emailSubjectSent: "אימעיל נושא",
    emailSubjectPlaceholder: "מענה: נאָכפֿאָלג פֿון אונדזער באַגעגעניש",
    emailBodySent: "אימעיל גוף",
    emailBodyPlaceholder: "קלעפּט דאָ דעם אימעיל...",
    notesOptional: "באַמערקונגען (אָפּציאָנאַל)",
    notesPlaceholder: "קאָנטעקסט וועגן דער שמועס",
    uploading: "לאָדט אַרויף...",
    addExample: "צוגעבן דוגמה",
    cancel: "אָפּזאָגן",
    addStyleExample: "+ צוגעבן סגנון דוגמה",
    generating: "שאַפֿט...",
    generateStyleProfile: "שאַפֿט סגנון פּראָפֿיל",
    activeStyleProfile: "אַקטיוו סגנון פּראָפֿיל",
    summaryStyle: "סיכום סגנון:",
    tone: "טאָן:",
    emailFormality: "אימעיל פֿאָרמאַליטעט:",
    emailLength: "אימעיל לענג:",
    structure: "סטרוקטור:",
    directness: "דירעקטנעס:",
    focusAreas: "פֿאָקוס געביטן:",
    basedOnExamples: "באַזירט אויף אַנאַליזירטע דוגמאות",
    noExamplesYet: "קיין סגנון דוגמאות נאָך.",
    deleteExample: "אויסמעקן",
    processingFailed: "פֿאַרארבעטונג דורכגעפֿאַלן",
    generationFailed: "שאַפֿונג דורכגעפֿאַלן",
    allFieldsRequired: "אַלע פֿעלדער זענען נויטיק.",
    uploadFailed: "אַרויפֿלאָדן דורכגעפֿאַלן",
    loading: "לאָדט...",

    // Delete
    deleteConversation: "אויסמעקן",
    confirmDelete: "צי זענט איר זיכער? דאָס קען נישט צוריקגענומען ווערן.",
    yes: "יאָ",
    deleteFailed: "אויסמעקן דורכגעפֿאַלן. פּרובירט נאָכאַמאָל.",

    // Audio recorder
    recordAudioTitle: "רעקאָרדירן אַודיאָ",
    startRecording: "אָנהייבן רעקאָרדירן",
    recording: "רעקאָרדירט",
    stop: "אָפּשטעלן",
    recordingComplete: "רעקאָרדירונג פֿאַרענדיקט",
    recordAgain: "רעקאָרדירן נאָכאַמאָל",
    micDenied: "מיקראָפֿאָן צוטריט אָפּגעזאָגט.",
    micNotFound: "קיין מיקראָפֿאָן נישט געפֿונען.",
    micInUse: "מיקראָפֿאָן איז אין נוצ.",
    micError: "קען נישט אָנהייבן רעקאָרדירן.",
    requestingMic: "בעט מיקראָפֿאָן צוטריט...",
    pause: "פּויזע",
    recordingPaused: "פּויזירט",
    resume: "פֿאָרזעצן",
    tryAgain: "פּרובירן נאָכאַמאָל",

    // Source picker
    sourceMicTitle: "נאָר מיקראָפֿאָן",
    sourceMicDesc: "רעקאָרדירן נאָר דײַן קול",
    sourceScreenTitle: "לעבעדיקע באַגעגעניש",
    sourceScreenDesc: "טיילט Zoom / Meet / Teams טאַב",
    sourceBothTitle: "באַגעגעניש + מיקראָפֿאָן",
    sourceBothDesc: "סיסטעם אַודיאָ מיט דײַן קול",
    screenAudioHint: "פֿאַר באַגעגענישן: קלויבט “שיין טאַב אַודיאָ” אין דעם טייל-דיאַלאָג. Chrome / Edge.",
    requestingScreen: "בעט עקראַן צוטריט...",
    recordingScreen: "רעקאָרדירט באַגעגעניש",
    recordingBoth: "רעקאָרדירט באַגעגעניש + מיקראָפֿאָן",
    screenDenied: "עקראַן-טיילן צוטריט אָפּגעזאָגט.",
    noSystemAudio: 'קיין אַודיאָ. קלויבט “שיין טאַב אַודיאָ” און פּרובירט נאָכאַמאָל.',

    // Mic permission denied guide (Yiddish — fallback to English)
    micDeniedTitle: 'Microphone access is blocked',
    micDeniedExplain: 'Your browser blocked microphone access. To fix it in Chrome:',
    micDeniedStep1: 'Click the lock icon',
    micDeniedStep1b: 'in the address bar (left of the URL)',
    micDeniedStep2: 'Go to “Site settings” \u2192 find “Microphone” \u2192 change to “Allow”',
    micDeniedStep3: 'Come back here and click “Try again” \u2014 recording will start immediately',
    micDeniedRetry: 'Try again \u2014 I allowed microphone access',

    // Meet guide (Yiddish — fallback to English)
    meetGuideTitleBoth: 'How to record a meeting + your microphone',
    meetGuideTitleScreen: 'How to record a meeting',
    meetStep1: 'Join your meeting (Meet, Zoom, Teams, etc.) in a separate tab',
    meetStep2: 'Click “Start” \u2014 a screen share dialog will open',
    meetStep3: 'Choose “Tab” and select your meeting tab',
    meetStep4: '\u2705 Check “Share tab audio” \u2014 this is required!',
    meetStep5: 'Click “Share”, then allow microphone access',
    meetStep5Screen: 'Click “Share”',
    meetAudioWarning: '\u26a0\ufe0f Chrome / Edge only \u2014 Safari doesn\'t support tab audio.',
    meetStartBtn: 'Got it \u2014 start screen share',

    // MP3 export
    downloadMp3: 'אַראָפּלאָדן ווי MP3',
    convertingMp3: 'מעוואַנדלט צו MP3...',
    mp3Failed: 'MP3 מעוואַנדלונג דורכגעפֿאַלן.',

    // File upload
    uploadAudioFile: "אַרויפֿלאָדן אַודיאָ טעקע",
    clickToSelect: "דריקט צו קלויבן אַ אַודיאָ טעקע",
    supportedFormatsLong: "MP3, WAV, M4A, WebM, OGG — ביז 100MB",
    change: "בייטן",
    fileTooLarge: "טעקע צו גרויס. מאַקסימום 100MB.",

    // Draft upload
    uploadToAnalyzeAction: "אַרויפֿלאָדן אַודיאָ צו אַנאַליזירן",

    // Editable title
    clickToEditTitle: "דריקט צו רעדאַקטירן",
  },
};

const RTL_LANGUAGES = new Set(["Hebrew", "Yiddish", "Arabic"]);

export function getLabels(language: string): UILabels {
  return LABELS[language] || LABELS.English;
}

export function isRTL(language: string): boolean {
  return RTL_LANGUAGES.has(language);
}

export function getHtmlLang(language: string): string {
  const map: Record<string, string> = {
    Hebrew: "he",
    English: "en",
    Yiddish: "yi",
    Arabic: "ar",
    Russian: "ru",
    French: "fr",
    Spanish: "es",
    German: "de",
  };
  return map[language] || "en";
}

import { useState, useMemo, useRef } from "react";

// ── Workflow Definition ──────────────────────────────────────────────────
const PHASES = [
  { id: 1, name: "Budget Review & Approval", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
  { id: 2, name: "Funding Request", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  { id: 3, name: "Signatures", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: 4, name: "Final Processing & System Updates", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
];

const ROLES = {
  HPA: { label: "Housing Program Analyst", short: "HPA", color: "#0891b2", bg: "#ecfeff", icon: "📋" },
  AE: { label: "Account Executive", short: "AE", color: "#2563eb", bg: "#eff6ff", icon: "👤" },
  FUND: { label: "Regional Funding Staff", short: "Funding", color: "#d97706", bg: "#fffbeb", icon: "💰" },
  OA: { label: "Owner/Agent", short: "OA", color: "#9333ea", bg: "#faf5ff", icon: "🏢" },
  BC: { label: "Branch Chief", short: "Branch Chief", color: "#059669", bg: "#ecfdf5", icon: "✍" },
  HQ: { label: "HUD HQ Funding", short: "HQ", color: "#dc2626", bg: "#fef2f2", icon: "🏛" },
  FW: { label: "Fort Worth / ACC", short: "Fort Worth", color: "#7c3aed", bg: "#f5f3ff", icon: "⚙" },
  SYS: { label: "Contract Admin / Systems", short: "Systems", color: "#475569", bg: "#f8fafc", icon: "💻" },
};

const WORKFLOW_STEPS = [
  { id: "1.0", phase: 1, role: "HPA", type: "action", label: "Log incoming correspondence in AMPS", dateField: "Date_AMPS_Log_Created", description: "HPA creates a LOG entry in AMPS for the incoming renewal package.", programNote: "BOTH", required: true, forwardTo: "1.1", forwardLabel: "Forward to Account Executive" },
  { id: "1.1", phase: 1, role: "AE", type: "action", label: "Receive & review renewal package from Owner/Agent", dateField: "Date_Rcvd_From_AE", description: "AE receives the owner's renewal documentation and reviews for completeness.", programNote: "BOTH", required: true, forwardTo: "1.2", forwardLabel: "Proceed to Completeness Check" },
  { id: "1.2", phase: 1, role: "AE", type: "decision", label: "Package complete?", dateField: null, description: "AE determines whether all required documentation has been submitted.", programNote: "S8: HUD-9624, 9625, rent roll, REAC>60, FMR comparison.\nPRAC: Budget worksheet, service coord reports, budget alignment.", isDecision: true, forwardTo: "1.3", forwardLabel: "Yes — Package Complete", altForwardTo: "1.2A", altForwardLabel: "No — Return for Corrections" },
  { id: "1.2A", phase: 1, role: "AE", type: "error", label: "Return to OA for corrections", dateField: "Date_Sent_Corrections_to_OA", description: "Package is incomplete — AE returns to Owner/Agent with list of needed items.", programNote: "BOTH", isCorrection: true, forwardTo: "1.1", forwardLabel: "Corrections Received — Re-review" },
  { id: "1.3", phase: 1, role: "AE", type: "action", label: "Determine renewal option & calculate funding need", dateField: "Date_Renewal_Option_Determined", description: "AE determines the appropriate renewal option and calculates the funding amount needed.", programNote: "S8: Mark-to-Market, At/Below Comparable, etc.\nPRAC: Standard renewal based on operating budget.", forwardTo: "1.4", forwardLabel: "Forward to Regional Funding Staff" },
  { id: "1.4", phase: 1, role: "AE", type: "action", label: "Forward to Regional Funding Staff", dateField: "Date_Sent_To_Funding", description: "AE prepares routing slip/funding sheet and sends to regional funding specialist.", programNote: "BOTH", required: true, forwardTo: "2.0", forwardLabel: "Route to Funding Staff" },

  { id: "2.0", phase: 2, role: "FUND", type: "action", label: "Receive package & verify funding calculations", dateField: "Date_Funding_Received_Package", description: "Funding specialist receives the package and verifies all funding calculations are correct.", programNote: "BOTH", required: true, forwardTo: "2.1", forwardLabel: "Proceed to Budget Check" },
  { id: "2.1", phase: 2, role: "FUND", type: "decision", label: "Sufficient regional budget authority?", dateField: null, description: "Funding staff checks whether there is enough budget authority in the region.", programNote: "S8: Check against regional PBRA allocation.\nPRAC: Check against PRAC authority.", isDecision: true, forwardTo: "2.2", forwardLabel: "Submit Funding Request to HQ" },
  { id: "2.2", phase: 2, role: "FUND", type: "action", label: "Submit funding request to HQ", dateField: "Date_Sent_Fund_Req", description: "Regional funding staff submits a formal funding request to HUD Headquarters.", programNote: "BOTH", required: true, forwardTo: "2.3", forwardLabel: "Awaiting HQ Response" },
  { id: "2.3", phase: 2, role: "HQ", type: "action", label: "HQ reviews & confirms funding", dateField: "Date_Fund_Rcvd_1", description: "HUD HQ reviews the funding request and confirms budget authority availability.", programNote: "S8: Verify PBRA budget authority.\nPRAC: Verify PRAC authority & check iCON.", required: true, forwardTo: "2.4", forwardLabel: "Funding Confirmed — Prepare Contract" },
  { id: "2.3A", phase: 2, role: "FUND", type: "action", label: "Additional funding request (if needed)", dateField: "Date_Sent_Fund_Req_2", description: "If initial funding is insufficient, submit a follow-up request for additional funds.", programNote: "BOTH", isOptional: true, forwardTo: "2.3B", forwardLabel: "Submit Additional Request" },
  { id: "2.3B", phase: 2, role: "HQ", type: "action", label: "Additional funding confirmed", dateField: "Date_Fund_Rcvd_2", description: "HQ confirms additional budget authority.", programNote: "BOTH", isOptional: true, forwardTo: "2.4", forwardLabel: "All Funding Confirmed" },
  { id: "2.4", phase: 2, role: "FUND", type: "action", label: "Prepare contract document for signatures", dateField: "Date_Contract_Prepared", description: "With funding confirmed, funding staff prepares the actual contract document for the signature routing process.", programNote: "BOTH", forwardTo: "3.0", forwardLabel: "Route Contract for Signatures" },

  { id: "3.0", phase: 3, role: "FUND", type: "action", label: "Send contract to Owner/Agent for signature", dateField: "Date_Sent_OA_Sign", description: "Prepared contract is sent to the property Owner/Agent for review and signature.", programNote: "BOTH", required: true, forwardTo: "3.1", forwardLabel: "Awaiting Owner Signature" },
  { id: "3.1", phase: 3, role: "OA", type: "action", label: "Owner/Agent signs & returns contract", dateField: "Date_Rcvd_OA_Sign", description: "Owner/Agent reviews, signs, and returns the executed contract.", programNote: "BOTH", required: true, forwardTo: "3.2", forwardLabel: "Forward to Branch Chief" },
  { id: "3.1A", phase: 3, role: "FUND", type: "error", label: "Contract returned for corrections", dateField: "Date_Sent_Corrections", description: "If contract has errors, it is returned for corrections before re-sending.", programNote: "BOTH", isCorrection: true, forwardTo: "3.0", forwardLabel: "Corrections Complete — Re-send" },
  { id: "3.2", phase: 3, role: "BC", type: "action", label: "Branch Chief reviews & signs", dateField: "Date_Sent_BC_Sign", description: "Branch Chief receives the owner-signed contract for review and government signature.", programNote: "BOTH", required: true, forwardTo: "3.3", forwardLabel: "Awaiting BC Signature" },
  { id: "3.3", phase: 3, role: "BC", type: "action", label: "Branch Chief signature received", dateField: "Date_Rcvd_BC_Sign", description: "Branch Chief has reviewed and signed the contract. Ready for final processing.", programNote: "BOTH", required: true, forwardTo: "4.0", forwardLabel: "Route to Fort Worth" },

  { id: "4.0", phase: 4, role: "BC", type: "action", label: "Forward to Fort Worth / ACC for processing", dateField: "Date_Sent_FW", description: "Fully signed contract is forwarded to Fort Worth Accounting Center for final processing and execution.", programNote: "BOTH", required: true, forwardTo: "4.1", forwardLabel: "Awaiting Fort Worth Processing" },
  { id: "4.1", phase: 4, role: "FW", type: "action", label: "Fort Worth processes & executes contract", dateField: "Date_FW_Complete", description: "Fort Worth/ACC processes the contract, enters it into the system, and executes it.", programNote: "BOTH", required: true, forwardTo: "4.2", forwardLabel: "Processing Complete — Update Systems" },
  { id: "4.2", phase: 4, role: "SYS", type: "action", label: "Update ARAMS / iCON", dateField: "Date_Systems_Updated", description: "Contract administration updates the relevant system of record.", programNote: "S8: Update ARAMS.\nPRAC: Update iCON.\n(CONDITIONAL — only step that truly differs by program)", required: true, forwardTo: "4.3", forwardLabel: "Systems Updated — Verify LOCCS" },
  { id: "4.3", phase: 4, role: "SYS", type: "action", label: "LOCCS verification complete", dateField: "Date_LOCCS_Complete", description: "Final verification in LOCCS that disbursement pathways are correctly set up.", programNote: "BOTH", required: true, forwardTo: "4.4", forwardLabel: "LOCCS Verified — Close Log" },
  { id: "4.4", phase: 4, role: "HPA", type: "action", label: "Close AMPS log", dateField: "Date_AMPS_Log_Closed", description: "HPA closes the original AMPS log entry, completing the tracking cycle.", programNote: "BOTH", forwardTo: "4.5", forwardLabel: "Mark Complete" },
  { id: "4.5", phase: 4, role: "SYS", type: "success", label: "Contract executed — Renewal complete", dateField: "Date_Contract_Executed", description: "The contract renewal is officially complete and fully executed in all systems.", programNote: "BOTH", required: true, isFinal: true },
];

// ── Staff Directory (for "Acting As" dropdown) ───────────────────────────
const STAFF = [
  { id: "self", name: "— My Actions —", role: null },
  { id: "bc1", name: "T. Walsh", role: "Branch Chief", region: "Region 2" },
  { id: "bc2", name: "P. Morgan", role: "Branch Chief", region: "Region 4" },
  { id: "bc3", name: "N. Okafor", role: "Branch Chief", region: "Region 5" },
  { id: "ae1", name: "R. Williams", role: "Account Executive", region: "Region 4" },
  { id: "ae2", name: "S. Patel", role: "Account Executive", region: "Region 5" },
  { id: "ae3", name: "K. Thompson", role: "Account Executive", region: "Region 2" },
  { id: "ae4", name: "L. Chen", role: "Account Executive", region: "Region 9" },
  { id: "ae5", name: "D. Garcia", role: "Account Executive", region: "Region 3" },
  { id: "fund1", name: "M. Torres", role: "Funding Specialist", region: "Region 4" },
  { id: "fund2", name: "A. Jackson", role: "Funding Specialist", region: "Region 2" },
  { id: "fund3", name: "C. Rivera", role: "Funding Specialist", region: "Region 5" },
  { id: "hpa1", name: "J. Rivera", role: "HPA", region: "Region 4" },
  { id: "hpa2", name: "B. Kim", role: "HPA", region: "Region 2" },
];

// ── Sample Contracts (with expiration dates for alert filtering) ──────────
const TODAY = new Date();
const daysFromNow = (n) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};

const SAMPLE_CONTRACTS = [
  { id: 1, contractNum: "HAP-10042", fhaNum: "123-45678", propName: "Sunrise Manor Apartments", program: "Section 8", region: "Region 4 - Atlanta", ae: "R. Williams", branchChief: "P. Morgan", fundingSpec: "M. Torres", units: 156, monthlyHAP: 87500, renewalOption: "Option 2: At/Below Comparable", contractExpiration: daysFromNow(45) },
  { id: 2, contractNum: "HAP-10078", fhaNum: "456-78901", propName: "Oak Creek Village", program: "PRAC", region: "Region 5 - Chicago", ae: "S. Patel", branchChief: "N. Okafor", fundingSpec: "C. Rivera", units: 64, monthlyHAP: 32400, renewalOption: "Standard Renewal", contractExpiration: daysFromNow(88) },
  { id: 3, contractNum: "HAP-10115", fhaNum: "789-01234", propName: "Cedar Hill Estates", program: "Section 8", region: "Region 2 - New York", ae: "K. Thompson", branchChief: "T. Walsh", fundingSpec: "A. Jackson", units: 220, monthlyHAP: 165000, renewalOption: "Option 3b: Full Mark-to-Market", contractExpiration: daysFromNow(-15) },
  { id: 4, contractNum: "HAP-10203", fhaNum: "234-56789", propName: "Elm Park Senior Living", program: "PRAC", region: "Region 9 - San Francisco", ae: "L. Chen", branchChief: "P. Morgan", fundingSpec: "M. Torres", units: 48, monthlyHAP: 28600, renewalOption: "Standard Renewal", contractExpiration: daysFromNow(115) },
  { id: 5, contractNum: "HAP-10287", fhaNum: "567-89012", propName: "Pine View Commons", program: "Section 8", region: "Region 3 - Philadelphia", ae: "D. Garcia", branchChief: "T. Walsh", fundingSpec: "A. Jackson", units: 92, monthlyHAP: 54200, renewalOption: "Option 1a: Mark-Up-To-Market", contractExpiration: daysFromNow(22) },
  { id: 6, contractNum: "HAP-10301", fhaNum: "345-67890", propName: "Maple Brook Towers", program: "Section 8", region: "Region 4 - Atlanta", ae: "R. Williams", branchChief: "P. Morgan", fundingSpec: "M. Torres", units: 180, monthlyHAP: 112000, renewalOption: "Option 4: Exempt from OAHP", contractExpiration: daysFromNow(200) },
  { id: 7, contractNum: "HAP-10355", fhaNum: "678-90123", propName: "Willow Glen Senior", program: "PRAC", region: "Region 2 - New York", ae: "K. Thompson", branchChief: "T. Walsh", fundingSpec: "A. Jackson", units: 36, monthlyHAP: 19800, renewalOption: "Standard Renewal", contractExpiration: daysFromNow(55) },
  { id: 8, contractNum: "HAP-10412", fhaNum: "901-23456", propName: "Birch Valley Apartments", program: "Section 8", region: "Region 5 - Chicago", ae: "S. Patel", branchChief: "N. Okafor", fundingSpec: "C. Rivera", units: 144, monthlyHAP: 78500, renewalOption: "Option 2: At/Below Comparable", contractExpiration: daysFromNow(-5) },
];

const DEMO_DATES = {
  1: { "Date_AMPS_Log_Created": "2025-08-12", "Date_Rcvd_From_AE": "2025-08-14", "Date_Sent_To_Funding": "2025-08-18", "Date_Funding_Received_Package": "2025-08-19", "Date_Sent_Fund_Req": "2025-08-22", "Date_Fund_Rcvd_1": "2025-09-03", "Date_Contract_Prepared": "2025-09-05", "Date_Sent_OA_Sign": "2025-09-06" },
  2: { "Date_AMPS_Log_Created": "2025-09-01", "Date_Rcvd_From_AE": "2025-09-03", "Date_Sent_To_Funding": "2025-09-06" },
  3: { "Date_AMPS_Log_Created": "2025-07-15", "Date_Rcvd_From_AE": "2025-07-17", "Date_Sent_To_Funding": "2025-07-20", "Date_Funding_Received_Package": "2025-07-21", "Date_Sent_Fund_Req": "2025-07-24", "Date_Fund_Rcvd_1": "2025-08-05", "Date_Contract_Prepared": "2025-08-07", "Date_Sent_OA_Sign": "2025-08-08", "Date_Rcvd_OA_Sign": "2025-08-15", "Date_Sent_BC_Sign": "2025-08-16", "Date_Rcvd_BC_Sign": "2025-08-19", "Date_Sent_FW": "2025-08-20", "Date_FW_Complete": "2025-09-02", "Date_Systems_Updated": "2025-09-03", "Date_LOCCS_Complete": "2025-09-04", "Date_Contract_Executed": "2025-09-04" },
  4: {},
  5: { "Date_AMPS_Log_Created": "2025-10-01" },
  6: { "Date_AMPS_Log_Created": "2025-10-10", "Date_Rcvd_From_AE": "2025-10-12" },
  7: { "Date_AMPS_Log_Created": "2025-09-20", "Date_Rcvd_From_AE": "2025-09-22", "Date_Sent_To_Funding": "2025-09-25", "Date_Funding_Received_Package": "2025-09-26", "Date_Sent_Fund_Req": "2025-09-28" },
  8: { "Date_AMPS_Log_Created": "2025-08-01" },
};

const DEMO_ATTACHMENTS = {
  "1-1.0": [{ name: "AMPS_Log_Entry_10042.pdf", size: "124 KB", date: "2025-08-12", addedBy: "J. Rivera (HPA)" }],
  "1-1.1": [
    { name: "Owner_Renewal_Package_SunriseManor.pdf", size: "2.4 MB", date: "2025-08-14", addedBy: "R. Williams (AE)" },
    { name: "HUD-9624_SunriseManor.pdf", size: "340 KB", date: "2025-08-14", addedBy: "R. Williams (AE)" },
    { name: "Rent_Roll_Aug2025.xlsx", size: "156 KB", date: "2025-08-14", addedBy: "R. Williams (AE)" },
  ],
  "1-1.4": [{ name: "Routing_Slip_HAP10042.pdf", size: "89 KB", date: "2025-08-18", addedBy: "R. Williams (AE)" }, { name: "Funding_Calculation_Sheet.xlsx", size: "67 KB", date: "2025-08-18", addedBy: "R. Williams (AE)" }],
  "1-2.2": [{ name: "Funding_Request_FY2025_HAP10042.pdf", size: "210 KB", date: "2025-08-22", addedBy: "M. Torres (Funding)" }],
  "1-2.3": [{ name: "HQ_Funding_Confirmation_HAP10042.pdf", size: "98 KB", date: "2025-09-03", addedBy: "HQ Funding Team" }],
  "1-3.0": [{ name: "Contract_Draft_HAP10042_v1.pdf", size: "1.8 MB", date: "2025-09-06", addedBy: "M. Torres (Funding)" }],
  "3-3.3": [{ name: "Signed_Contract_CedarHill_BC.pdf", size: "3.1 MB", date: "2025-08-19", addedBy: "T. Walsh (Branch Chief)" }],
  "3-4.1": [{ name: "FW_Execution_Confirmation_HAP10115.pdf", size: "145 KB", date: "2025-09-02", addedBy: "Fort Worth ACC" }],
};

// ── Helpers ──────────────────────────────────────────────────────────────
function daysBetween(d1, d2) {
  if (!d1 || !d2) return null;
  return Math.round((new Date(d2) - new Date(d1)) / 86400000);
}
function todayStr() { return new Date().toISOString().split("T")[0]; }

function getAutoStatus(dates) {
  if (dates.Date_Contract_Executed) return { code: "06", label: "Complete", color: "#34d399" };
  if (dates.Date_Sent_FW) return { code: "05", label: "In Final Processing", color: "#2dd4bf" };
  if (dates.Date_Sent_OA_Sign) return { code: "04", label: "In Signature Process", color: "#a78bfa" };
  if (dates.Date_Sent_Fund_Req) return { code: "03", label: "Awaiting Funding", color: "#f59e0b" };
  if (dates.Date_Rcvd_From_AE) return { code: "02", label: "Documentation Received", color: "#60a5fa" };
  if (dates.Date_Sent_Corrections || dates.Date_Sent_Corrections_to_OA) return { code: "90", label: "Pending Corrections", color: "#f87171" };
  return { code: "01", label: "Not Started", color: "#94a3b8" };
}

function getExpirationAlert(expDate) {
  const days = daysBetween(todayStr(), expDate);
  if (days === null) return { level: "none", label: "No Date", color: "#94a3b8", bg: "#f8fafc" };
  if (days < 0) return { level: "expired", label: `Expired (${Math.abs(days)}d ago)`, color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "🔴" };
  if (days <= 30) return { level: "30", label: `${days}d remaining`, color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "🔴" };
  if (days <= 60) return { level: "60", label: `${days}d remaining`, color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", icon: "🟠" };
  if (days <= 90) return { level: "90", label: `${days}d remaining`, color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: "🟡" };
  if (days <= 120) return { level: "120", label: `${days}d remaining`, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", icon: "🔵" };
  return { level: "none", label: `${days}d remaining`, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: "🟢" };
}

function fileIcon(name) {
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return { icon: "📄", color: "#dc2626" };
  if (["xlsx", "xls", "csv"].includes(ext)) return { icon: "📊", color: "#16a34a" };
  if (["docx", "doc"].includes(ext)) return { icon: "📝", color: "#2563eb" };
  if (["png", "jpg", "jpeg", "gif"].includes(ext)) return { icon: "🖼", color: "#9333ea" };
  if (["msg", "eml"].includes(ext)) return { icon: "✉", color: "#d97706" };
  return { icon: "📎", color: "#64748b" };
}

// ── Components ───────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: status.color + "22", color: status.color, border: `1px solid ${status.color}44` }}>
    <span style={{ width: 8, height: 8, borderRadius: "50%", background: status.color, boxShadow: `0 0 6px ${status.color}66` }} />
    {status.label}
  </span>
);

const AlertBadge = ({ alert }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: alert.bg, color: alert.color, border: `1px solid ${alert.border || alert.color + "33"}` }}>
    {alert.icon} {alert.label}
  </span>
);

const RoleBadge = ({ roleKey, size = "sm" }) => {
  const r = ROLES[roleKey];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: size === "lg" ? "4px 10px" : "2px 8px", borderRadius: 5, fontSize: size === "lg" ? 12 : 10, fontWeight: 700, letterSpacing: 0.3, background: r.bg, color: r.color, border: `1px solid ${r.color}33` }}>
      <span style={{ fontSize: size === "lg" ? 13 : 11 }}>{r.icon}</span> {r.short}
    </span>
  );
};

const SelectStyle = { padding: "6px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 11, background: "#fff", outline: "none", color: "#1e293b", fontWeight: 500, cursor: "pointer" };

// ── Main App ─────────────────────────────────────────────────────────────
export default function ApprovalFlow() {
  // Filters
  const [filterProgram, setFilterProgram] = useState("All");
  const [filterAlert, setFilterAlert] = useState("All");
  const [selectedContractId, setSelectedContractId] = useState(1);

  // Acting As (role override)
  const [actingAs, setActingAs] = useState("self");

  // Phase collapse — phases beyond the current step default to collapsed
  const [collapsedPhases, setCollapsedPhases] = useState({});

  // Data state
  const [contractDates, setContractDates] = useState(() => {
    const init = {};
    SAMPLE_CONTRACTS.forEach(c => { init[c.id] = { ...(DEMO_DATES[c.id] || {}) }; });
    return init;
  });
  const [attachments, setAttachments] = useState(DEMO_ATTACHMENTS);
  const [notes, setNotes] = useState({});
  const [expandedStep, setExpandedStep] = useState(null);
  const [viewMode, setViewMode] = useState("flow");
  const [showProgramNotes, setShowProgramNotes] = useState(true);
  const [forwardConfirm, setForwardConfirm] = useState(null);
  const [activityLog, setActivityLog] = useState([
    { time: "2025-09-06 10:32", action: "Contract sent to Owner/Agent for signature", user: "M. Torres (Funding)", contract: "HAP-10042", stepId: "3.0" },
    { time: "2025-09-05 14:15", action: "Contract document prepared", user: "M. Torres (Funding)", contract: "HAP-10042", stepId: "2.4" },
    { time: "2025-09-03 09:45", action: "HQ confirmed funding", user: "HQ Funding Team", contract: "HAP-10042", stepId: "2.3" },
  ]);
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);

  // Filtered contracts
  const filteredContracts = useMemo(() => {
    return SAMPLE_CONTRACTS.filter(c => {
      if (filterProgram !== "All" && c.program !== filterProgram) return false;
      if (filterAlert !== "All") {
        const alert = getExpirationAlert(c.contractExpiration);
        if (filterAlert === "expired" && alert.level !== "expired") return false;
        if (filterAlert === "30" && !(alert.level === "expired" || alert.level === "30")) return false;
        if (filterAlert === "60" && !(alert.level === "expired" || alert.level === "30" || alert.level === "60")) return false;
        if (filterAlert === "90" && !(alert.level === "expired" || alert.level === "30" || alert.level === "60" || alert.level === "90")) return false;
        if (filterAlert === "120" && alert.level === "none") return false;
        if (filterAlert === "none" && alert.level !== "none") return false;
      }
      return true;
    });
  }, [filterProgram, filterAlert]);

  // Make sure selected contract is in the filtered list
  const contract = SAMPLE_CONTRACTS.find(c => c.id === selectedContractId);
  const dates = contractDates[selectedContractId] || {};
  const status = getAutoStatus(dates);
  const expAlert = contract ? getExpirationAlert(contract.contractExpiration) : { level: "none", label: "", color: "#94a3b8" };

  const actingStaff = STAFF.find(s => s.id === actingAs);
  const actingLabel = actingAs === "self" ? "Current User" : `${actingStaff.name} (${actingStaff.role}) — acting on behalf`;

  const setDate = (field, value) => {
    setContractDates(prev => ({ ...prev, [selectedContractId]: { ...prev[selectedContractId], [field]: value } }));
  };
  const clearDate = (field) => {
    setContractDates(prev => {
      const updated = { ...prev[selectedContractId] };
      delete updated[field];
      return { ...prev, [selectedContractId]: updated };
    });
  };
  const getAttachmentKey = (stepId) => `${selectedContractId}-${stepId}`;
  const getStepAttachments = (stepId) => attachments[getAttachmentKey(stepId)] || [];
  const addAttachment = (stepId, files) => {
    const key = getAttachmentKey(stepId);
    const newFiles = Array.from(files).map(f => ({
      name: f.name,
      size: f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`,
      date: todayStr(),
      addedBy: actingLabel,
    }));
    setAttachments(prev => ({ ...prev, [key]: [...(prev[key] || []), ...newFiles] }));
  };
  const removeAttachment = (stepId, idx) => {
    const key = getAttachmentKey(stepId);
    setAttachments(prev => ({ ...prev, [key]: (prev[key] || []).filter((_, i) => i !== idx) }));
  };

  const handleForward = (step, targetStepId) => {
    if (step.dateField && !dates[step.dateField]) setDate(step.dateField, todayStr());
    const targetStep = WORKFLOW_STEPS.find(s => s.id === targetStepId);
    const targetRole = targetStep ? ROLES[targetStep.role] : null;
    setActivityLog(prev => [{
      time: new Date().toISOString().replace("T", " ").slice(0, 16),
      action: `${step.forwardLabel || "Forwarded"} → ${targetRole ? targetRole.label : targetStepId}`,
      user: actingLabel,
      contract: contract.contractNum,
      stepId: step.id,
    }, ...prev]);
    setExpandedStep(targetStepId);
    setForwardConfirm(null);
  };

  const getStepStatus = (step) => {
    if (!step.dateField) {
      const nextStep = WORKFLOW_STEPS[WORKFLOW_STEPS.indexOf(step) + 1];
      return nextStep?.dateField && dates[nextStep.dateField] ? "complete" : "pending";
    }
    if (dates[step.dateField]) return "complete";
    const idx = WORKFLOW_STEPS.indexOf(step);
    const prevSteps = WORKFLOW_STEPS.slice(0, idx).filter(s => s.dateField && s.required);
    const allPrevDone = prevSteps.every(s => dates[s.dateField]);
    if (allPrevDone && !step.isOptional && !step.isCorrection) return "current";
    return "pending";
  };

  const phaseProgress = PHASES.map(p => {
    const phaseSteps = WORKFLOW_STEPS.filter(s => s.phase === p.id && s.dateField && !s.isOptional && !s.isCorrection);
    const done = phaseSteps.filter(s => dates[s.dateField]).length;
    return { ...p, done, total: phaseSteps.length, pct: phaseSteps.length ? Math.round((done / phaseSteps.length) * 100) : 0 };
  });

  // Determine which phase contains the current active work based on contract status
  const currentPhaseId = useMemo(() => {
    const s = getAutoStatus(dates);
    // Map status codes to their active phase
    if (s.code === "06") return 4; // Complete — show final phase
    if (s.code === "05") return 4; // In Final Processing
    if (s.code === "04") return 3; // In Signature Process
    if (s.code === "03") return 2; // Awaiting Funding
    if (s.code === "02") return 1; // Documentation Received
    if (s.code === "90") return 1; // Pending Corrections — back in early phase
    return 1; // Not Started
  }, [dates]);

  // Phase is collapsed if: (a) user explicitly toggled it, or (b) it defaults to collapsed (any phase that isn't the current one)
  const isPhaseCollapsed = (phaseId) => {
    if (collapsedPhases[phaseId] !== undefined) return collapsedPhases[phaseId];
    // Default: only the current phase is expanded; completed and future phases collapse
    return phaseId !== currentPhaseId;
  };

  const togglePhase = (phaseId) => {
    setCollapsedPhases(prev => ({ ...prev, [phaseId]: !isPhaseCollapsed(phaseId) }));
  };

  // Reset collapsed state when switching contracts
  const selectContract = (id) => {
    setSelectedContractId(id);
    setExpandedStep(null);
    setCollapsedPhases({});
  };

  const handleFileInputChange = (e) => {
    if (uploadTarget && e.target.files.length) addAttachment(uploadTarget, e.target.files);
    setUploadTarget(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', -apple-system, sans-serif", background: "#f1f5f9", minHeight: "100vh", color: "#0f172a" }}>
      <input type="file" ref={fileInputRef} style={{ display: "none" }} multiple onChange={handleFileInputChange} />

      {/* ── Prototype Banner ── */}
      <div style={{ background: "#fef2f2", borderBottom: "2px solid #fecaca", padding: "6px 24px", textAlign: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", letterSpacing: 0.3 }}>
          PROTOTYPE — Contract Funding Approval Flow &middot; HUD Multifamily Housing &middot; Attachments, routing &amp; delegation are simulated for demo
        </span>
      </div>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg, #0c2d6b 0%, #1e40af 50%, #1d4ed8 100%)", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>H</div>
          <div>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Contract Funding Approval Flow</div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 10 }}>HUD Multifamily Housing &middot; Process Routing, Attachments &amp; Date Entry</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: 3 }}>
          {[{ id: "flow", label: "Approval Flow" }, { id: "activity", label: "Activity Log" }, { id: "summary", label: "Summary" }].map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)}
              style={{ padding: "5px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: viewMode === v.id ? "rgba(255,255,255,0.95)" : "transparent", color: viewMode === v.id ? "#1e40af" : "rgba(255,255,255,0.7)" }}>{v.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "14px 24px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ══════════════════════════════════════════════════════════════════════
            FILTER BAR
           ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ background: "linear-gradient(180deg, #dbeafe 0%, #eff6ff 100%)", borderRadius: 12, border: "1px solid #bfdbfe", padding: "10px 16px", marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>

          {/* Program Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#1e40af", textTransform: "uppercase", letterSpacing: 0.5 }}>Program</span>
            <select value={filterProgram} onChange={e => { setFilterProgram(e.target.value); const f = SAMPLE_CONTRACTS.filter(c => e.target.value === "All" || c.program === e.target.value); const keep = f.find(c => c.id === selectedContractId); if (!keep && f[0]) selectContract(f[0].id); }} style={SelectStyle}>
              <option value="All">All Programs</option>
              <option value="Section 8">Section 8</option>
              <option value="PRAC">PRAC</option>
            </select>
          </div>

          {/* Contract Alert Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#1e40af", textTransform: "uppercase", letterSpacing: 0.5 }}>Alert</span>
            <select value={filterAlert} onChange={e => setFilterAlert(e.target.value)} style={SelectStyle}>
              <option value="All">All Contracts</option>
              <option value="expired">🔴 Expired</option>
              <option value="30">🔴 Due ≤ 30 days</option>
              <option value="60">🟠 Due ≤ 60 days</option>
              <option value="90">🟡 Due ≤ 90 days</option>
              <option value="120">🔵 Due ≤ 120 days</option>
              <option value="none">🟢 No Alert (&gt;120 days)</option>
            </select>
          </div>

          {/* Contract Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#1e40af", textTransform: "uppercase", letterSpacing: 0.5 }}>Contract</span>
            <select value={selectedContractId} onChange={e => { selectContract(Number(e.target.value)); }}
              style={{ ...SelectStyle, minWidth: 260 }}>
              {filteredContracts.map(c => {
                const a = getExpirationAlert(c.contractExpiration);
                const s = getAutoStatus(contractDates[c.id] || {});
                return <option key={c.id} value={c.id}>{c.contractNum} — {c.propName} [{c.program}] {a.icon || ""}</option>;
              })}
              {filteredContracts.length === 0 && <option disabled>No contracts match filters</option>}
            </select>
          </div>

          <div style={{ width: 1, height: 28, background: "#93c5fd" }} />

          {/* Acting As Override */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#1e40af", textTransform: "uppercase", letterSpacing: 0.5 }}>Acting As</span>
            <select value={actingAs} onChange={e => setActingAs(e.target.value)}
              style={{ ...SelectStyle, minWidth: 200, borderColor: actingAs !== "self" ? "#f59e0b" : "#e2e8f0", background: actingAs !== "self" ? "#fffbeb" : "#fff" }}>
              <option value="self">— My Actions —</option>
              <optgroup label="Branch Chiefs">
                {STAFF.filter(s => s.role === "Branch Chief").map(s => <option key={s.id} value={s.id}>{s.name} — {s.role} ({s.region})</option>)}
              </optgroup>
              <optgroup label="Account Executives">
                {STAFF.filter(s => s.role === "Account Executive").map(s => <option key={s.id} value={s.id}>{s.name} — {s.role} ({s.region})</option>)}
              </optgroup>
              <optgroup label="Funding Specialists">
                {STAFF.filter(s => s.role === "Funding Specialist").map(s => <option key={s.id} value={s.id}>{s.name} — {s.role} ({s.region})</option>)}
              </optgroup>
              <optgroup label="HPAs">
                {STAFF.filter(s => s.role === "HPA").map(s => <option key={s.id} value={s.id}>{s.name} — {s.role} ({s.region})</option>)}
              </optgroup>
            </select>
          </div>

          {/* Acting As indicator */}
          {actingAs !== "self" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: "#fef3c7", border: "1px solid #fde68a", fontSize: 10, color: "#92400e", fontWeight: 600 }}>
              ⚠ Acting on behalf of {actingStaff.name}
              <button onClick={() => setActingAs("self")} style={{ border: "none", background: "none", color: "#92400e", cursor: "pointer", fontWeight: 800, fontSize: 12 }}>✕</button>
            </div>
          )}

          <label style={{ marginLeft: "auto", fontSize: 10, color: "#1e40af", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input type="checkbox" checked={showProgramNotes} onChange={e => setShowProgramNotes(e.target.checked)} />
            Program notes
          </label>
        </div>

        {/* ── Contract Header Card ── */}
        {contract && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "14px 20px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{contract.contractNum} — {contract.propName}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {contract.fhaNum} &middot; {contract.region} &middot; {contract.units} units &middot; ${contract.monthlyHAP.toLocaleString()}/mo &middot; {contract.renewalOption}
                </div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 4, display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <span>👤 AE: <strong>{contract.ae}</strong></span>
                  <span>✍ BC: <strong>{contract.branchChief}</strong></span>
                  <span>💰 Funding: <strong>{contract.fundingSpec}</strong></span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: contract.program === "Section 8" ? "#eff6ff" : "#f5f3ff", color: contract.program === "Section 8" ? "#1e40af" : "#7c3aed", fontWeight: 700, border: `1px solid ${contract.program === "Section 8" ? "#bfdbfe" : "#ddd6fe"}` }}>
                    {contract.program}
                  </span>
                  <StatusBadge status={status} />
                </div>
                <AlertBadge alert={expAlert} />
              </div>
            </div>
            {/* Phase progress */}
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              {phaseProgress.map(p => (
                <div key={p.id} style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: p.color, textTransform: "uppercase", letterSpacing: 0.5 }}>Phase {p.id}</span>
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>{p.done}/{p.total}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "#e2e8f0" }}>
                    <div style={{ height: 5, borderRadius: 3, background: p.color, width: `${p.pct}%`, transition: "width 0.4s" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ APPROVAL FLOW VIEW ═══ */}
        {viewMode === "flow" && contract && (
          <div style={{ marginLeft: 16, paddingLeft: 16, borderLeft: "3px solid #bfdbfe" }}>
            {PHASES.map(phase => {
              const steps = WORKFLOW_STEPS.filter(s => s.phase === phase.id);
              const collapsed = isPhaseCollapsed(phase.id);
              const phaseHasCurrent = steps.some(s => getStepStatus(s) === "current");
              const phaseDone = steps.filter(s => s.dateField && dates[s.dateField]).length;
              const phaseTotal = steps.filter(s => s.dateField).length;
              const allStepsComplete = steps.filter(s => s.dateField && !s.isOptional && !s.isCorrection).every(s => dates[s.dateField]);
              const noStepsStarted = !steps.some(s => s.dateField && dates[s.dateField]);

              return (
                <div key={phase.id} style={{ marginBottom: 12 }}>
                  {/* Phase Header — clickable to toggle collapse */}
                  <div onClick={() => togglePhase(phase.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, marginBottom: collapsed ? 0 : 5,
                      padding: "7px 14px", borderRadius: collapsed ? 10 : 10,
                      background: phase.bg, border: `1px solid ${phase.border}`, cursor: "pointer",
                      transition: "all 0.15s",
                    }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: allStepsComplete ? "#16a34a" : phase.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 11, fontWeight: 700,
                    }}>
                      {allStepsComplete ? "✓" : phase.id}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: allStepsComplete ? "#16a34a" : phase.color }}>{phase.name}</span>

                    {/* Collapsed summary chips */}
                    {collapsed && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 8 }}>
                        {allStepsComplete && <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 600 }}>All steps complete</span>}
                        {noStepsStarted && !allStepsComplete && <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>Not yet started</span>}
                        {phaseHasCurrent && <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 10, background: phase.color, color: "#fff", fontWeight: 700 }}>● Active</span>}
                        {!allStepsComplete && !noStepsStarted && !phaseHasCurrent && <span style={{ fontSize: 10, color: "#d97706", fontWeight: 600 }}>In progress — {phaseDone}/{phaseTotal} dates</span>}
                      </div>
                    )}

                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, color: phase.color, opacity: 0.6 }}>{phaseDone}/{phaseTotal} dates</span>
                      <span style={{
                        fontSize: 14, color: phase.color, opacity: 0.5,
                        transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
                        transition: "transform 0.2s",
                      }}>▸</span>
                    </div>
                  </div>

                  {/* Steps — visible when NOT collapsed */}
                  {!collapsed && (
                  <div style={{ display: "grid", gap: 3, paddingLeft: 14 }}>
                    {steps.map(step => {
                      const stepStatus = getStepStatus(step);
                      const isExpanded = expandedStep === step.id;
                      const isComplete = stepStatus === "complete";
                      const isCurrent = stepStatus === "current";
                      const stepAttachments = getStepAttachments(step.id);
                      const nextRole = step.forwardTo ? WORKFLOW_STEPS.find(s => s.id === step.forwardTo) : null;

                      return (
                        <div key={step.id} style={{
                          borderRadius: 10, overflow: "hidden",
                          border: isCurrent ? `2px solid ${phase.color}` : isComplete ? "1px solid #d1fae5" : "1px solid #e2e8f0",
                          background: isCurrent ? phase.bg : isComplete ? "#f0fdf4" : "#fff",
                          boxShadow: isCurrent ? `0 0 0 3px ${phase.color}22` : "none",
                          opacity: step.isOptional && !dates[step.dateField] ? 0.55 : 1,
                        }}>
                          {/* Step Header */}
                          <div onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                            style={{ display: "grid", gridTemplateColumns: "48px 78px 1fr auto auto 120px 24px", padding: "8px 14px", alignItems: "center", gap: 8, cursor: "pointer" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: isComplete ? "#16a34a" : isCurrent ? phase.color : "#94a3b8" }}>
                              {isComplete ? "✓" : isCurrent ? "●" : "○"} {step.id}
                            </span>
                            <RoleBadge roleKey={step.role} />
                            <div>
                              <span style={{ fontSize: 12, fontWeight: isComplete || isCurrent ? 600 : 400, color: isComplete ? "#166534" : isCurrent ? "#1e293b" : "#64748b" }}>{step.label}</span>
                              {step.isDecision && <span style={{ marginLeft: 6, fontSize: 9, color: "#d97706", fontWeight: 700 }}>◆ DECISION</span>}
                              {step.isCorrection && <span style={{ marginLeft: 6, fontSize: 9, color: "#dc2626", fontWeight: 700 }}>↩ CORRECTION</span>}
                              {step.isOptional && <span style={{ marginLeft: 6, fontSize: 9, color: "#94a3b8" }}>(optional)</span>}
                              {step.isFinal && <span style={{ marginLeft: 6, fontSize: 9, color: "#059669", fontWeight: 700 }}>★ FINAL</span>}
                            </div>
                            {stepAttachments.length > 0 ? (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }}>📎 {stepAttachments.length}</span>
                            ) : <span />}
                            {showProgramNotes && step.programNote !== "BOTH" && step.programNote ? (
                              <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>⚙ PROGRAM</span>
                            ) : <span />}
                            <div style={{ textAlign: "right" }}>
                              {step.dateField && dates[step.dateField] ? (
                                <span style={{ fontSize: 11, fontWeight: 600, color: "#16a34a" }}>{dates[step.dateField]}</span>
                              ) : step.dateField ? (
                                <span style={{ fontSize: 10, color: isCurrent ? phase.color : "#cbd5e1", fontWeight: isCurrent ? 600 : 400 }}>{isCurrent ? "⏳ Awaiting" : "No date"}</span>
                              ) : null}
                            </div>
                            <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▸</span>
                          </div>

                          {/* Expanded */}
                          {isExpanded && (
                            <div style={{ borderTop: "1px solid #e2e8f0", background: "#fafbfc" }}>
                              <div style={{ padding: "12px 16px 0 58px" }}>
                                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 8 }}>{step.description}</div>
                                {showProgramNotes && step.programNote && step.programNote !== "BOTH" && (
                                  <div style={{ fontSize: 11, color: "#92400e", background: "#fef3c7", padding: "8px 12px", borderRadius: 6, marginBottom: 8, border: "1px solid #fde68a", lineHeight: 1.5, whiteSpace: "pre-line" }}>
                                    <strong>⚙ Program-specific criteria:</strong><br />{step.programNote}
                                  </div>
                                )}
                                {/* Date Entry */}
                                {step.dateField && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                                    <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, fontFamily: "monospace", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>{step.dateField}</span>
                                    <input type="date" value={dates[step.dateField] || ""} onClick={e => e.stopPropagation()}
                                      onChange={e => { e.stopPropagation(); setDate(step.dateField, e.target.value); }}
                                      style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12, background: "#fff", outline: "none" }} />
                                    {dates[step.dateField] && (
                                      <button onClick={e => { e.stopPropagation(); clearDate(step.dateField); }}
                                        style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>Clear</button>
                                    )}
                                    {step.dateField === "Date_Fund_Rcvd_1" && dates.Date_Sent_Fund_Req && dates.Date_Fund_Rcvd_1 && <span style={{ fontSize: 11, color: "#1e40af", fontWeight: 600 }}>⏱ HQ: {daysBetween(dates.Date_Sent_Fund_Req, dates.Date_Fund_Rcvd_1)}d</span>}
                                    {step.dateField === "Date_Rcvd_OA_Sign" && dates.Date_Sent_OA_Sign && dates.Date_Rcvd_OA_Sign && <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600 }}>⏱ Owner: {daysBetween(dates.Date_Sent_OA_Sign, dates.Date_Rcvd_OA_Sign)}d</span>}
                                    {step.dateField === "Date_Rcvd_BC_Sign" && dates.Date_Sent_BC_Sign && dates.Date_Rcvd_BC_Sign && <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>⏱ BC: {daysBetween(dates.Date_Sent_BC_Sign, dates.Date_Rcvd_BC_Sign)}d</span>}
                                    {step.dateField === "Date_FW_Complete" && dates.Date_Sent_FW && dates.Date_FW_Complete && <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600 }}>⏱ FW: {daysBetween(dates.Date_Sent_FW, dates.Date_FW_Complete)}d</span>}
                                    {step.isFinal && dates.Date_Rcvd_From_AE && dates.Date_Contract_Executed && <span style={{ fontSize: 12, color: "#047857", fontWeight: 700, padding: "2px 10px", background: "#d1fae5", borderRadius: 6 }}>🏁 Total: {daysBetween(dates.Date_Rcvd_From_AE, dates.Date_Contract_Executed)}d</span>}
                                  </div>
                                )}
                              </div>

                              {/* Attachments */}
                              <div style={{ padding: "0 16px 0 58px", marginBottom: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>📎 Attachments ({stepAttachments.length})</span>
                                  <button onClick={e => { e.stopPropagation(); setUploadTarget(step.id); fileInputRef.current?.click(); }}
                                    style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>+ Attach File</button>
                                </div>
                                {stepAttachments.length > 0 ? (
                                  <div style={{ display: "grid", gap: 2 }}>
                                    {stepAttachments.map((att, i) => {
                                      const fi = fileIcon(att.name);
                                      return (
                                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: "#fff", border: "1px solid #e2e8f0" }}>
                                          <span style={{ fontSize: 15 }}>{fi.icon}</span>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</div>
                                            <div style={{ fontSize: 9, color: "#94a3b8" }}>{att.size} &middot; {att.date} &middot; {att.addedBy}</div>
                                          </div>
                                          <button onClick={e => { e.stopPropagation(); removeAttachment(step.id, i); }}
                                            style={{ padding: "2px 5px", borderRadius: 4, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 9, cursor: "pointer" }}>✕</button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic", padding: "4px 0" }}>No attachments. Click "Attach File" to upload.</div>}
                              </div>

                              {/* Notes */}
                              <div style={{ padding: "0 16px 8px 58px" }}>
                                <textarea placeholder="Add notes..." value={notes[`${selectedContractId}-${step.id}`] || ""} onClick={e => e.stopPropagation()}
                                  onChange={e => { e.stopPropagation(); setNotes(prev => ({ ...prev, [`${selectedContractId}-${step.id}`]: e.target.value })); }}
                                  style={{ width: "100%", padding: "5px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 11, fontFamily: "inherit", resize: "vertical", minHeight: 30, outline: "none", background: "#fff" }} />
                              </div>

                              {/* Forward Action */}
                              {step.forwardTo && !step.isFinal && (
                                <div style={{ padding: "8px 16px 10px 58px", borderTop: "1px solid #e2e8f0", background: isCurrent ? phase.bg : "#f8fafc", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                  {forwardConfirm === `${step.id}-fwd` ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontSize: 11, color: "#475569" }}>Forward to <strong>{nextRole ? ROLES[nextRole.role].label : step.forwardTo}</strong>{actingAs !== "self" ? ` (as ${actingStaff.name})` : ""}?</span>
                                      <button onClick={e => { e.stopPropagation(); handleForward(step, step.forwardTo); }}
                                        style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: phase.color, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✓ Confirm &amp; Forward</button>
                                      <button onClick={e => { e.stopPropagation(); setForwardConfirm(null); }}
                                        style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                                    </div>
                                  ) : (
                                    <button onClick={e => { e.stopPropagation(); setForwardConfirm(`${step.id}-fwd`); }}
                                      style={{
                                        padding: "5px 14px", borderRadius: 8, border: "none",
                                        background: isCurrent ? phase.color : "#e2e8f0", color: isCurrent ? "#fff" : "#475569",
                                        fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                                        boxShadow: isCurrent ? `0 2px 8px ${phase.color}44` : "none",
                                      }}>
                                      {step.forwardLabel} → {nextRole && <RoleBadge roleKey={nextRole.role} />}
                                    </button>
                                  )}
                                  {step.altForwardTo && (
                                    <>
                                      {forwardConfirm === `${step.id}-alt` ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                          <button onClick={e => { e.stopPropagation(); handleForward(step, step.altForwardTo); }}
                                            style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✓ Confirm</button>
                                          <button onClick={e => { e.stopPropagation(); setForwardConfirm(null); }}
                                            style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                                        </div>
                                      ) : (
                                        <button onClick={e => { e.stopPropagation(); setForwardConfirm(`${step.id}-alt`); }}
                                          style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                          {step.altForwardLabel} ↩
                                        </button>
                                      )}
                                    </>
                                  )}
                                  {actingAs !== "self" && (
                                    <span style={{ fontSize: 10, color: "#92400e", fontStyle: "italic", marginLeft: 4 }}>Acting as {actingStaff.name}</span>
                                  )}
                                </div>
                              )}
                              {step.isFinal && dates.Date_Contract_Executed && (
                                <div style={{ padding: "10px 16px 12px 58px", borderTop: "1px solid #bbf7d0", background: "#f0fdf4", textAlign: "center" }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: "#047857" }}>🎉 Contract Renewal Complete</div>
                                  <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2 }}>Total cycle: {daysBetween(dates.Date_Rcvd_From_AE, dates.Date_Contract_Executed)} days &middot; Executed {dates.Date_Contract_Executed}</div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ ACTIVITY LOG VIEW ═══ */}
        {viewMode === "activity" && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#1e293b" }}>Activity Log — All Routing Actions</div>
            {activityLog.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>No activity yet.</div>}
            <div style={{ display: "grid", gap: 3 }}>
              {activityLog.map((entry, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "130px 90px 1fr 180px", padding: "7px 14px", borderRadius: 6, background: "#fafbfc", border: "1px solid #f1f5f9", fontSize: 11, alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: 10 }}>{entry.time}</span>
                  <span style={{ fontWeight: 600, color: "#1e40af" }}>{entry.contract}</span>
                  <span style={{ color: "#1e293b" }}>{entry.action}</span>
                  <span style={{ color: entry.user.includes("acting") ? "#92400e" : "#64748b", textAlign: "right", fontWeight: entry.user.includes("acting") ? 600 : 400 }}>{entry.user}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SUMMARY VIEW ═══ */}
        {viewMode === "summary" && contract && (
          <div>
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 20, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#1e293b" }}>Turnaround Time — {contract.contractNum}</div>
              {[
                { label: "AE Review", sent: "Date_Rcvd_From_AE", rcvd: "Date_Sent_To_Funding", color: "#2563eb" },
                { label: "HQ Funding Response", sent: "Date_Sent_Fund_Req", rcvd: "Date_Fund_Rcvd_1", color: "#d97706", target: 10 },
                { label: "Owner/Agent Signature", sent: "Date_Sent_OA_Sign", rcvd: "Date_Rcvd_OA_Sign", color: "#9333ea", target: 10 },
                { label: "Branch Chief Review", sent: "Date_Sent_BC_Sign", rcvd: "Date_Rcvd_BC_Sign", color: "#059669", target: 5 },
                { label: "Fort Worth Processing", sent: "Date_Sent_FW", rcvd: "Date_FW_Complete", color: "#7c3aed", target: 10 },
                { label: "Total End-to-End", sent: "Date_Rcvd_From_AE", rcvd: "Date_Contract_Executed", color: "#0f172a", target: 60 },
              ].map((pair, i) => {
                const d = daysBetween(dates[pair.sent], dates[pair.rcvd]);
                const hasBoth = dates[pair.sent] && dates[pair.rcvd];
                const over = pair.target && d > pair.target;
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "170px 95px 95px 65px 1fr", padding: "8px 14px", borderRadius: 8, marginBottom: 3, alignItems: "center", background: hasBoth ? (over ? "#fef2f2" : "#f0fdf4") : "#fafbfc", border: `1px solid ${hasBoth ? (over ? "#fecaca" : "#bbf7d0") : "#f1f5f9"}` }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: pair.color }}>{pair.label}</span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{dates[pair.sent] || "—"}</span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{dates[pair.rcvd] || "—"}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, textAlign: "center", color: hasBoth ? (over ? "#dc2626" : "#16a34a") : "#cbd5e1" }}>{d != null ? `${d}d` : "—"}</span>
                    <div style={{ height: 4, borderRadius: 2, background: "#e2e8f0" }}>{hasBoth && pair.target && <div style={{ height: 4, borderRadius: 2, background: over ? "#ef4444" : "#34d399", width: `${Math.min((d / pair.target) * 100, 100)}%` }} />}</div>
                  </div>
                );
              })}
            </div>

            {/* All Contracts Status Overview */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#1e293b" }}>All Contracts — Status &amp; Alert Overview</div>
              <div style={{ display: "grid", gap: 3 }}>
                {SAMPLE_CONTRACTS.map(c => {
                  const d = contractDates[c.id] || {};
                  const s = getAutoStatus(d);
                  const a = getExpirationAlert(c.contractExpiration);
                  return (
                    <div key={c.id} onClick={() => { selectContract(c.id); setViewMode("flow"); }}
                      style={{ display: "grid", gridTemplateColumns: "110px 1fr 80px 120px 140px", padding: "8px 14px", borderRadius: 8, background: "#fafbfc", border: "1px solid #f1f5f9", cursor: "pointer", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#1e40af" }}>{c.contractNum}</span>
                      <span style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.propName}</span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>{c.program}</span>
                      <AlertBadge alert={a} />
                      <StatusBadge status={s} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", padding: "16px 0 8px", fontSize: 10, color: "#94a3b8" }}>
          HUD Multifamily Housing &middot; Funding Workflow Tracker
        </div>
      </div>
    </div>
  );
}

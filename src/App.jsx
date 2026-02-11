import { useState, useMemo, useRef } from "react";

// ══════════════════════════════════════════════════════════════════════════
// SHARED DATA MODEL
// ══════════════════════════════════════════════════════════════════════════

const REGIONS = ["Region 2 - New York", "Region 3 - Philadelphia", "Region 4 - Atlanta", "Region 5 - Chicago", "Region 9 - San Francisco"];
const PROGRAMS = ["Section 8", "PRAC"];

const STATUS_CODES = [
  { code: "01", label: "Not Started", color: "#94a3b8" },
  { code: "02", label: "Documentation Received", color: "#60a5fa" },
  { code: "03", label: "Awaiting Funding", color: "#f59e0b" },
  { code: "04", label: "In Signature Process", color: "#a78bfa" },
  { code: "05", label: "In Final Processing", color: "#2dd4bf" },
  { code: "06", label: "Complete", color: "#34d399" },
  { code: "90", label: "Pending Corrections", color: "#f87171" },
  { code: "99", label: "On Hold", color: "#cbd5e1" },
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

const PHASES = [
  { id: 1, name: "Budget Review & Approval", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
  { id: 2, name: "Funding Request", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  { id: 3, name: "Signatures", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: 4, name: "Final Processing & System Updates", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
];

const WORKFLOW_STEPS = [
  { id: "1.0", phase: 1, role: "HPA", type: "action", label: "Log incoming correspondence in AMPS", dateField: "Date_AMPS_Log_Created", programNote: "BOTH", required: true, forwardTo: "1.1", forwardLabel: "Forward to Account Executive", description: "HPA creates a LOG entry in AMPS for the incoming renewal package." },
  { id: "1.1", phase: 1, role: "AE", type: "action", label: "Receive & review renewal package", dateField: "Date_Rcvd_From_AE", programNote: "BOTH", required: true, forwardTo: "1.2", forwardLabel: "Proceed to Completeness Check", description: "AE receives the owner's renewal documentation and reviews for completeness." },
  { id: "1.2", phase: 1, role: "AE", type: "decision", label: "Package complete?", dateField: null, programNote: "S8: HUD-9624, 9625, rent roll, REAC>60, FMR comparison.\nPRAC: Budget worksheet, service coord reports, budget alignment.", isDecision: true, forwardTo: "1.3", forwardLabel: "Yes — Complete", altForwardTo: "1.2A", altForwardLabel: "No — Corrections", description: "AE determines whether all required documentation has been submitted." },
  { id: "1.2A", phase: 1, role: "AE", type: "error", label: "Return to OA for corrections", dateField: "Date_Sent_Corrections_to_OA", programNote: "BOTH", isCorrection: true, forwardTo: "1.1", forwardLabel: "Corrections Received — Re-review", description: "Package is incomplete — AE returns to Owner/Agent with list of needed items." },
  { id: "1.3", phase: 1, role: "AE", type: "action", label: "Determine renewal option & calculate funding", dateField: "Date_Renewal_Option_Determined", programNote: "S8: Mark-to-Market, At/Below Comparable, etc.\nPRAC: Standard renewal based on operating budget.", forwardTo: "1.4", forwardLabel: "Forward to Funding Staff", description: "AE determines the appropriate renewal option and calculates funding." },
  { id: "1.4", phase: 1, role: "AE", type: "action", label: "Forward to Regional Funding Staff", dateField: "Date_Sent_To_Funding", programNote: "BOTH", required: true, forwardTo: "2.0", forwardLabel: "Route to Funding", description: "AE prepares routing slip/funding sheet and sends to regional funding specialist." },
  { id: "2.0", phase: 2, role: "FUND", type: "action", label: "Receive & verify funding calculations", dateField: "Date_Funding_Received_Package", programNote: "BOTH", required: true, forwardTo: "2.1", forwardLabel: "Proceed to Budget Check", description: "Funding specialist receives the package and verifies all calculations." },
  { id: "2.1", phase: 2, role: "FUND", type: "decision", label: "Sufficient regional budget authority?", dateField: null, programNote: "S8: Check PBRA allocation.\nPRAC: Check PRAC authority.", isDecision: true, forwardTo: "2.2", forwardLabel: "Submit to HQ", description: "Funding staff checks regional budget authority." },
  { id: "2.2", phase: 2, role: "FUND", type: "action", label: "Submit funding request to HQ", dateField: "Date_Sent_Fund_Req", programNote: "BOTH", required: true, forwardTo: "2.3", forwardLabel: "Awaiting HQ", description: "Regional funding staff submits formal request to HQ." },
  { id: "2.3", phase: 2, role: "HQ", type: "action", label: "HQ reviews & confirms funding", dateField: "Date_Fund_Rcvd_1", programNote: "S8: Verify PBRA authority.\nPRAC: Verify PRAC authority & iCON.", required: true, forwardTo: "2.4", forwardLabel: "Funding Confirmed", description: "HUD HQ reviews and confirms budget authority." },
  { id: "2.4", phase: 2, role: "FUND", type: "action", label: "Prepare contract for signatures", dateField: "Date_Contract_Prepared", programNote: "BOTH", forwardTo: "3.0", forwardLabel: "Route for Signatures", description: "Funding staff prepares the contract document." },
  { id: "3.0", phase: 3, role: "FUND", type: "action", label: "Send contract to Owner/Agent", dateField: "Date_Sent_OA_Sign", programNote: "BOTH", required: true, forwardTo: "3.1", forwardLabel: "Awaiting OA Signature", description: "Contract sent to Owner/Agent for signature." },
  { id: "3.1", phase: 3, role: "OA", type: "action", label: "Owner/Agent signs & returns", dateField: "Date_Rcvd_OA_Sign", programNote: "BOTH", required: true, forwardTo: "3.2", forwardLabel: "Forward to Branch Chief", description: "Owner/Agent reviews, signs, and returns the contract." },
  { id: "3.1A", phase: 3, role: "FUND", type: "error", label: "Contract returned for corrections", dateField: "Date_Sent_Corrections", programNote: "BOTH", isCorrection: true, forwardTo: "3.0", forwardLabel: "Corrections Complete — Re-send", description: "Contract has errors — returned for corrections." },
  { id: "3.2", phase: 3, role: "BC", type: "action", label: "Branch Chief reviews & signs", dateField: "Date_Sent_BC_Sign", programNote: "BOTH", required: true, forwardTo: "3.3", forwardLabel: "Awaiting BC Signature", description: "Branch Chief receives for review and government signature." },
  { id: "3.3", phase: 3, role: "BC", type: "action", label: "Branch Chief signature received", dateField: "Date_Rcvd_BC_Sign", programNote: "BOTH", required: true, forwardTo: "4.0", forwardLabel: "Route to Fort Worth", description: "BC signed. Ready for final processing." },
  { id: "4.0", phase: 4, role: "BC", type: "action", label: "Forward to Fort Worth / ACC", dateField: "Date_Sent_FW", programNote: "BOTH", required: true, forwardTo: "4.1", forwardLabel: "Awaiting FW Processing", description: "Signed contract forwarded to Fort Worth ACC." },
  { id: "4.1", phase: 4, role: "FW", type: "action", label: "Fort Worth processes & executes", dateField: "Date_FW_Complete", programNote: "BOTH", required: true, forwardTo: "4.2", forwardLabel: "Update Systems", description: "Fort Worth processes and executes contract." },
  { id: "4.2", phase: 4, role: "SYS", type: "action", label: "Update ARAMS / iCON", dateField: "Date_Systems_Updated", programNote: "S8: Update ARAMS.\nPRAC: Update iCON.", required: true, forwardTo: "4.3", forwardLabel: "Verify LOCCS", description: "Update relevant system of record." },
  { id: "4.3", phase: 4, role: "SYS", type: "action", label: "LOCCS verification", dateField: "Date_LOCCS_Complete", programNote: "BOTH", required: true, forwardTo: "4.4", forwardLabel: "Close Log", description: "Verify LOCCS disbursement pathways." },
  { id: "4.4", phase: 4, role: "HPA", type: "action", label: "Close AMPS log", dateField: "Date_AMPS_Log_Closed", programNote: "BOTH", forwardTo: "4.5", forwardLabel: "Mark Complete", description: "HPA closes the AMPS log entry." },
  { id: "4.5", phase: 4, role: "SYS", type: "success", label: "Contract executed — Complete", dateField: "Date_Contract_Executed", programNote: "BOTH", required: true, isFinal: true, description: "Contract renewal officially complete." },
];

// ── Staff Directory ──────────────────────────────────────────────────────
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

// ── Sample Contracts ─────────────────────────────────────────────────────
const TODAY = new Date();
const daysFromNow = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0]; };
function addDays(dateStr, days) { if (!dateStr) return null; const d = new Date(dateStr); d.setDate(d.getDate() + days); return d.toISOString().split("T")[0]; }
function randomDate(startD, endD) { const d = new Date(startD.getTime() + Math.random() * (endD.getTime() - startD.getTime())); return d.toISOString().split("T")[0]; }

const PROP_FIRST = ["Sunrise","Oak","Cedar","Elm","Pine","Maple","Willow","Birch","Cherry","Holly","Walnut","Spruce","Laurel","Aspen","Magnolia","Hawthorn","Alder","Beech","Chestnut","Cypress","Hickory","Juniper","Linden","Poplar","Sequoia","Sycamore","Redwood","Dogwood","Fern","Ivy"];
const PROP_SECOND = ["Manor","Creek","Hill","Park","View","Brook","Glen","Ridge","Valley","Meadow","Springs","Terrace","Landing","Crossing","Heights","Pointe","Cove","Harbor","Station","Gardens"];
const PROP_SUFFIX = ["Apartments","Village","Estates","Towers","Commons","Senior Living","Residences","Place"];
const RENEWAL_OPTS_S8 = ["Option 1a: Mark-Up-To-Market","Option 1b: Discretionary Mark-Up","Option 2: At/Below Comparable","Option 3b: Full Mark-to-Market","Option 4: Exempt from OAHP","Option 5b: Preservation"];
const REGION_STAFF = {
  "Region 2 - New York": { aes: ["K. Thompson"], bcs: ["T. Walsh"], funds: ["A. Jackson"] },
  "Region 3 - Philadelphia": { aes: ["D. Garcia"], bcs: ["T. Walsh"], funds: ["A. Jackson"] },
  "Region 4 - Atlanta": { aes: ["R. Williams"], bcs: ["P. Morgan"], funds: ["M. Torres"] },
  "Region 5 - Chicago": { aes: ["S. Patel"], bcs: ["N. Okafor"], funds: ["C. Rivera"] },
  "Region 9 - San Francisco": { aes: ["L. Chen"], bcs: ["P. Morgan"], funds: ["M. Torres"] },
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function generateContracts(n) {
  const contracts = [];
  const dateMap = {};
  // Status distribution: realistic pipeline (weighted)
  // 01=8%, 02=10%, 03=18%, 04=12%, 05=8%, 06=30%, 90=10%, 99=4%
  const statusWeights = [1,1,2,2,2,3,3,3,3,4,4,4,5,5,5,6,6,6,6,6,6,6,6,6,7,7,7,8];
  const statusMap = {1:"01",2:"02",3:"03",4:"04",5:"05",6:"06",7:"90",8:"99"};

  for (let i = 0; i < n; i++) {
    const id = 100 + i;
    const region = pick(REGIONS);
    const staff = REGION_STAFF[region];
    const program = Math.random() < 0.76 ? "Section 8" : "PRAC";
    const renewalOption = program === "Section 8" ? pick(RENEWAL_OPTS_S8) : "Standard Renewal";
    const contractNum = `HAP-${String(10500 + i).padStart(5, "0")}`;
    const fhaNum = `${rInt(100, 999)}-${rInt(10000, 99999)}`;
    const propName = `${pick(PROP_FIRST)} ${pick(PROP_SECOND)} ${pick(PROP_SUFFIX)}`;
    const units = rInt(20, 300);
    const monthlyHAP = rInt(12000, 200000);
    // Expiration spread: some expired, some urgent, most future
    const expDays = pick([-30,-15,-5,5,15,22,35,45,55,70,88,100,115,130,150,180,200,250,300,365]);
    const contractExpiration = daysFromNow(expDays);
    const ae = pick(staff.aes);
    const bc = pick(staff.bcs);
    const fund = pick(staff.funds);

    // Generate dates based on status
    const sw = statusMap[statusWeights[i % statusWeights.length]];
    const statusIdx = STATUS_CODES.findIndex(s => s.code === sw);
    const dates = {};
    const baseDate = randomDate(new Date("2024-09-01"), new Date("2025-11-01"));

    if (statusIdx >= 1 || sw === "90") dates.Date_AMPS_Log_Created = baseDate;
    if (statusIdx >= 1) {
      dates.Date_Rcvd_From_AE = addDays(baseDate, rInt(1, 3));
      if (statusIdx >= 2 || sw === "90") {
        dates.Date_Sent_To_Funding = addDays(dates.Date_Rcvd_From_AE, rInt(2, 5));
        dates.Date_Funding_Received_Package = addDays(dates.Date_Sent_To_Funding, rInt(1, 2));
        dates.Date_Sent_Fund_Req = addDays(dates.Date_Funding_Received_Package, rInt(1, 4));
      }
      if (statusIdx >= 3) {
        dates.Date_Fund_Rcvd_1 = addDays(dates.Date_Sent_Fund_Req, rInt(5, 22));
        dates.Date_Contract_Prepared = addDays(dates.Date_Fund_Rcvd_1, rInt(1, 3));
        dates.Date_Sent_OA_Sign = addDays(dates.Date_Contract_Prepared, rInt(0, 2));
      }
      if (statusIdx >= 4) {
        dates.Date_Rcvd_OA_Sign = addDays(dates.Date_Sent_OA_Sign, rInt(3, 18));
        dates.Date_Sent_BC_Sign = addDays(dates.Date_Rcvd_OA_Sign, rInt(1, 2));
        dates.Date_Rcvd_BC_Sign = addDays(dates.Date_Sent_BC_Sign, rInt(2, 6));
        dates.Date_Sent_FW = addDays(dates.Date_Rcvd_BC_Sign, rInt(0, 1));
      }
      if (statusIdx >= 5) {
        dates.Date_FW_Complete = addDays(dates.Date_Sent_FW, rInt(5, 18));
        dates.Date_Systems_Updated = addDays(dates.Date_FW_Complete, rInt(1, 3));
        dates.Date_LOCCS_Complete = addDays(dates.Date_Systems_Updated, rInt(1, 2));
        dates.Date_Contract_Executed = dates.Date_LOCCS_Complete;
      }
    }
    if (sw === "90") {
      dates.Date_Sent_Corrections = addDays(dates.Date_Sent_Fund_Req || dates.Date_Rcvd_From_AE, rInt(3, 10));
    }

    contracts.push({ id, contractNum, fhaNum, propName, program, region, ae, branchChief: bc, fundingSpec: fund, units, monthlyHAP, renewalOption, contractExpiration });
    dateMap[id] = dates;
  }
  return { contracts, dateMap };
}

// Keep original 8 hand-crafted contracts
const HANDCRAFTED = [
  { id: 1, contractNum: "HAP-10042", fhaNum: "123-45678", propName: "Sunrise Manor Apartments", program: "Section 8", region: "Region 4 - Atlanta", ae: "R. Williams", branchChief: "P. Morgan", fundingSpec: "M. Torres", units: 156, monthlyHAP: 87500, renewalOption: "Option 2: At/Below Comparable", contractExpiration: daysFromNow(45) },
  { id: 2, contractNum: "HAP-10078", fhaNum: "456-78901", propName: "Oak Creek Village", program: "PRAC", region: "Region 5 - Chicago", ae: "S. Patel", branchChief: "N. Okafor", fundingSpec: "C. Rivera", units: 64, monthlyHAP: 32400, renewalOption: "Standard Renewal", contractExpiration: daysFromNow(88) },
  { id: 3, contractNum: "HAP-10115", fhaNum: "789-01234", propName: "Cedar Hill Estates", program: "Section 8", region: "Region 2 - New York", ae: "K. Thompson", branchChief: "T. Walsh", fundingSpec: "A. Jackson", units: 220, monthlyHAP: 165000, renewalOption: "Option 3b: Full Mark-to-Market", contractExpiration: daysFromNow(-15) },
  { id: 4, contractNum: "HAP-10203", fhaNum: "234-56789", propName: "Elm Park Senior Living", program: "PRAC", region: "Region 9 - San Francisco", ae: "L. Chen", branchChief: "P. Morgan", fundingSpec: "M. Torres", units: 48, monthlyHAP: 28600, renewalOption: "Standard Renewal", contractExpiration: daysFromNow(115) },
  { id: 5, contractNum: "HAP-10287", fhaNum: "567-89012", propName: "Pine View Commons", program: "Section 8", region: "Region 3 - Philadelphia", ae: "D. Garcia", branchChief: "T. Walsh", fundingSpec: "A. Jackson", units: 92, monthlyHAP: 54200, renewalOption: "Option 1a: Mark-Up-To-Market", contractExpiration: daysFromNow(22) },
  { id: 6, contractNum: "HAP-10301", fhaNum: "345-67890", propName: "Maple Brook Towers", program: "Section 8", region: "Region 4 - Atlanta", ae: "R. Williams", branchChief: "P. Morgan", fundingSpec: "M. Torres", units: 180, monthlyHAP: 112000, renewalOption: "Option 4: Exempt from OAHP", contractExpiration: daysFromNow(200) },
  { id: 7, contractNum: "HAP-10355", fhaNum: "678-90123", propName: "Willow Glen Senior", program: "PRAC", region: "Region 2 - New York", ae: "K. Thompson", branchChief: "T. Walsh", fundingSpec: "A. Jackson", units: 36, monthlyHAP: 19800, renewalOption: "Standard Renewal", contractExpiration: daysFromNow(55) },
  { id: 8, contractNum: "HAP-10412", fhaNum: "901-23456", propName: "Birch Valley Apartments", program: "Section 8", region: "Region 5 - Chicago", ae: "S. Patel", branchChief: "N. Okafor", fundingSpec: "C. Rivera", units: 144, monthlyHAP: 78500, renewalOption: "Option 2: At/Below Comparable", contractExpiration: daysFromNow(-5) },
];

const HANDCRAFTED_DATES = {
  1: { Date_AMPS_Log_Created: "2025-08-12", Date_Rcvd_From_AE: "2025-08-14", Date_Sent_To_Funding: "2025-08-18", Date_Funding_Received_Package: "2025-08-19", Date_Sent_Fund_Req: "2025-08-22", Date_Fund_Rcvd_1: "2025-09-03", Date_Contract_Prepared: "2025-09-05", Date_Sent_OA_Sign: "2025-09-06" },
  2: { Date_AMPS_Log_Created: "2025-09-01", Date_Rcvd_From_AE: "2025-09-03", Date_Sent_To_Funding: "2025-09-06" },
  3: { Date_AMPS_Log_Created: "2025-07-15", Date_Rcvd_From_AE: "2025-07-17", Date_Sent_To_Funding: "2025-07-20", Date_Funding_Received_Package: "2025-07-21", Date_Sent_Fund_Req: "2025-07-24", Date_Fund_Rcvd_1: "2025-08-05", Date_Contract_Prepared: "2025-08-07", Date_Sent_OA_Sign: "2025-08-08", Date_Rcvd_OA_Sign: "2025-08-15", Date_Sent_BC_Sign: "2025-08-16", Date_Rcvd_BC_Sign: "2025-08-19", Date_Sent_FW: "2025-08-20", Date_FW_Complete: "2025-09-02", Date_Systems_Updated: "2025-09-03", Date_LOCCS_Complete: "2025-09-04", Date_Contract_Executed: "2025-09-04" },
  4: {},
  5: { Date_AMPS_Log_Created: "2025-10-01" },
  6: { Date_AMPS_Log_Created: "2025-10-10", Date_Rcvd_From_AE: "2025-10-12" },
  7: { Date_AMPS_Log_Created: "2025-09-20", Date_Rcvd_From_AE: "2025-09-22", Date_Sent_To_Funding: "2025-09-25", Date_Funding_Received_Package: "2025-09-26", Date_Sent_Fund_Req: "2025-09-28" },
  8: { Date_AMPS_Log_Created: "2025-08-01" },
};

const { contracts: GEN_CONTRACTS, dateMap: GEN_DATES } = generateContracts(92);
const CONTRACTS_INIT = [...HANDCRAFTED, ...GEN_CONTRACTS]; // 100 total

const DATES_INIT_ALL = { ...HANDCRAFTED_DATES, ...GEN_DATES };

const ATTACHMENTS_INIT = {
  "1-1.0": [{ name: "AMPS_Log_Entry_10042.pdf", size: "124 KB", date: "2025-08-12", addedBy: "J. Rivera (HPA)" }],
  "1-1.1": [{ name: "Owner_Renewal_Package.pdf", size: "2.4 MB", date: "2025-08-14", addedBy: "R. Williams (AE)" }, { name: "HUD-9624.pdf", size: "340 KB", date: "2025-08-14", addedBy: "R. Williams (AE)" }, { name: "Rent_Roll_Aug2025.xlsx", size: "156 KB", date: "2025-08-14", addedBy: "R. Williams (AE)" }],
  "1-1.4": [{ name: "Routing_Slip.pdf", size: "89 KB", date: "2025-08-18", addedBy: "R. Williams (AE)" }],
  "1-2.2": [{ name: "Funding_Request_FY2025.pdf", size: "210 KB", date: "2025-08-22", addedBy: "M. Torres (Funding)" }],
  "1-2.3": [{ name: "HQ_Funding_Confirmation.pdf", size: "98 KB", date: "2025-09-03", addedBy: "HQ Funding Team" }],
  "1-3.0": [{ name: "Contract_Draft_v1.pdf", size: "1.8 MB", date: "2025-09-06", addedBy: "M. Torres (Funding)" }],
  "3-3.3": [{ name: "Signed_Contract_CedarHill.pdf", size: "3.1 MB", date: "2025-08-19", addedBy: "T. Walsh (BC)" }],
};

// ── Helpers ──────────────────────────────────────────────────────────────
function daysBetween(d1, d2) { if (!d1 || !d2) return null; return Math.round((new Date(d2) - new Date(d1)) / 86400000); }
function todayStr() { return new Date().toISOString().split("T")[0]; }
function getAutoStatus(dates) {
  if (dates.Date_Contract_Executed) return STATUS_CODES[5];
  if (dates.Date_Sent_FW) return STATUS_CODES[4];
  if (dates.Date_Sent_OA_Sign) return STATUS_CODES[3];
  if (dates.Date_Sent_Fund_Req) return STATUS_CODES[2];
  if (dates.Date_Rcvd_From_AE) return STATUS_CODES[1];
  if (dates.Date_Sent_Corrections || dates.Date_Sent_Corrections_to_OA) return STATUS_CODES[6];
  return STATUS_CODES[0];
}
function getExpirationAlert(exp) {
  const d = daysBetween(todayStr(), exp);
  if (d === null) return { level: "none", label: "No Date", color: "#94a3b8", bg: "#f8fafc", icon: "" };
  if (d < 0) return { level: "expired", label: `Expired (${Math.abs(d)}d)`, color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "🔴" };
  if (d <= 30) return { level: "30", label: `${d}d`, color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "🔴" };
  if (d <= 60) return { level: "60", label: `${d}d`, color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", icon: "🟠" };
  if (d <= 90) return { level: "90", label: `${d}d`, color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: "🟡" };
  if (d <= 120) return { level: "120", label: `${d}d`, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", icon: "🔵" };
  return { level: "none", label: `${d}d`, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: "🟢" };
}
function fileIcon(name) {
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return "📄"; if (["xlsx","xls","csv"].includes(ext)) return "📊"; if (["docx","doc"].includes(ext)) return "📝"; return "📎";
}

// ── Small Components ─────────────────────────────────────────────────────
const Pill = ({ children, color, bg }) => (<span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 24, fontWeight: 600, background: bg || color + "22", color, border: `1px solid ${color}44` }}>{children}</span>);
const StatusBadge = ({ status }) => (<Pill color={status.color}><span style={{ width: 7, height: 7, borderRadius: "50%", background: status.color }} />{status.label}</Pill>);
const RoleBadge = ({ roleKey }) => { const r = ROLES[roleKey]; return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 5, fontSize: 17, fontWeight: 700, background: r.bg, color: r.color, border: `1px solid ${r.color}33` }}>{r.icon} {r.short}</span>; };
const Metric = ({ label, value, sub, accent }) => (<div style={{ padding: "16px 18px", borderRadius: 12, background: "#fff", border: "1px solid #e2e8f0", flex: 1, minWidth: 130 }}><div style={{ fontSize: 17, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 5 }}>{label}</div><div style={{ fontSize: 32, fontWeight: 700, color: accent || "#0f172a", lineHeight: 1.1 }}>{value}</div>{sub && <div style={{ fontSize: 17, color: "#94a3b8", marginTop: 3 }}>{sub}</div>}</div>);
const Bar = ({ pct, color }) => (<div style={{ height: 5, borderRadius: 3, background: "#e2e8f0", width: "100%" }}><div style={{ height: 5, borderRadius: 3, background: color, width: `${Math.min(pct, 100)}%`, transition: "width 0.4s" }} /></div>);
const Sel = (props) => (<select {...props} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 24, background: "#fff", outline: "none", fontWeight: 500, cursor: "pointer", ...props.style }}>{props.children}</select>);

// ══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Navigation & filters ──
  const [view, setView] = useState("dashboard");
  const [filterProgram, setFilterProgram] = useState("All");
  const [filterAlert, setFilterAlert] = useState("All");
  const [filterRegion, setFilterRegion] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  // ── Approval flow state ──
  const [selectedContractId, setSelectedContractId] = useState(1);
  const [actingAs, setActingAs] = useState("self");
  const [contractDates, setContractDates] = useState(() => { const o = {}; CONTRACTS_INIT.forEach(c => o[c.id] = { ...(DATES_INIT_ALL[c.id] || {}) }); return o; });
  const [attachments, setAttachments] = useState(ATTACHMENTS_INIT);
  const [notes, setNotes] = useState({});
  const [expandedStep, setExpandedStep] = useState(null);
  const [collapsedPhases, setCollapsedPhases] = useState({});
  const [showProgramNotes, setShowProgramNotes] = useState(true);
  const [forwardConfirm, setForwardConfirm] = useState(null);
  const [activityLog, setActivityLog] = useState([
    { time: "2025-09-06 10:32", action: "Sent contract to OA for signature", user: "M. Torres (Funding)", contract: "HAP-10042" },
    { time: "2025-09-03 09:45", action: "HQ confirmed funding", user: "HQ Funding Team", contract: "HAP-10042" },
  ]);
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);

  // ── New contract intake ──
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const emptyForm = { contractNum: "", fhaNum: "", propName: "", program: "Section 8", region: REGIONS[0], units: "", monthlyHAP: "", renewalOption: "Option 2: At/Below Comparable", contractExpiration: "" };
  const [newForm, setNewForm] = useState(emptyForm);
  const handleNewContract = () => {
    const id = 9000 + CONTRACTS_INIT.length + Math.floor(Math.random() * 1000);
    const staff = REGION_STAFF[newForm.region];
    const c = { id, contractNum: newForm.contractNum || `HAP-${id}`, fhaNum: newForm.fhaNum || "000-00000", propName: newForm.propName || "New Property", program: newForm.program, region: newForm.region, ae: staff.aes[0], branchChief: staff.bcs[0], fundingSpec: staff.funds[0], units: parseInt(newForm.units) || 0, monthlyHAP: parseInt(newForm.monthlyHAP) || 0, renewalOption: newForm.program === "PRAC" ? "Standard Renewal" : newForm.renewalOption, contractExpiration: newForm.contractExpiration || daysFromNow(120) };
    CONTRACTS_INIT.push(c);
    setContractDates(p => ({ ...p, [id]: {} }));
    setShowNewForm(false);
    setNewForm(emptyForm);
    selectContract(id);
    setView("workflow");
    setActivityLog(p => [{ time: new Date().toISOString().replace("T", " ").slice(0, 16), action: "New contract created", user: actingLabel, contract: c.contractNum }, ...p]);
  };

  // ── Derived data ──
  const allContracts = useMemo(() => CONTRACTS_INIT.map(c => {
    const d = contractDates[c.id] || {};
    return { ...c, dates: d, status: getAutoStatus(d), alert: getExpirationAlert(c.contractExpiration) };
  }), [contractDates]);

  const filtered = useMemo(() => allContracts.filter(c => {
    if (filterProgram !== "All" && c.program !== filterProgram) return false;
    if (filterRegion !== "All" && c.region !== filterRegion) return false;
    if (filterAlert !== "All") {
      const a = c.alert;
      if (filterAlert === "expired" && a.level !== "expired") return false;
      if (filterAlert === "30" && !["expired","30"].includes(a.level)) return false;
      if (filterAlert === "60" && !["expired","30","60"].includes(a.level)) return false;
      if (filterAlert === "90" && !["expired","30","60","90"].includes(a.level)) return false;
      if (filterAlert === "120" && a.level === "none") return false;
      if (filterAlert === "none" && a.level !== "none") return false;
    }
    if (searchTerm) { const s = searchTerm.toLowerCase(); if (![c.contractNum, c.propName, c.fhaNum, c.ae].some(f => f.toLowerCase().includes(s))) return false; }
    return true;
  }), [allContracts, filterProgram, filterRegion, filterAlert, searchTerm]);

  const contract = allContracts.find(c => c.id === selectedContractId);
  const dates = contractDates[selectedContractId] || {};
  const actingStaff = STAFF.find(s => s.id === actingAs);
  const actingLabel = actingAs === "self" ? "Current User" : `${actingStaff.name} (${actingStaff.role}) — acting on behalf`;

  // ── Metrics ──
  const metrics = useMemo(() => {
    const byStatus = {}; STATUS_CODES.forEach(s => byStatus[s.code] = 0);
    allContracts.forEach(c => byStatus[c.status.code]++);
    const completed = allContracts.filter(c => c.status.code === "06");
    const cycleTimes = completed.map(c => daysBetween(c.dates.Date_Rcvd_From_AE, c.dates.Date_Contract_Executed)).filter(Boolean);
    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const fundT = allContracts.filter(c => c.dates.Date_Sent_Fund_Req && c.dates.Date_Fund_Rcvd_1).map(c => daysBetween(c.dates.Date_Sent_Fund_Req, c.dates.Date_Fund_Rcvd_1));
    const oaT = allContracts.filter(c => c.dates.Date_Sent_OA_Sign && c.dates.Date_Rcvd_OA_Sign).map(c => daysBetween(c.dates.Date_Sent_OA_Sign, c.dates.Date_Rcvd_OA_Sign));
    const fwT = allContracts.filter(c => c.dates.Date_Sent_FW && c.dates.Date_FW_Complete).map(c => daysBetween(c.dates.Date_Sent_FW, c.dates.Date_FW_Complete));
    const bcT = allContracts.filter(c => c.dates.Date_Sent_BC_Sign && c.dates.Date_Rcvd_BC_Sign).map(c => daysBetween(c.dates.Date_Sent_BC_Sign, c.dates.Date_Rcvd_BC_Sign));
    return { byStatus, total: allContracts.length, completed: completed.length, avgCycle: avg(cycleTimes), avgFund: avg(fundT), avgOA: avg(oaT), avgFW: avg(fwT), avgBC: avg(bcT) };
  }, [allContracts]);

  const regionMetrics = useMemo(() => {
    const rm = {}; REGIONS.forEach(r => rm[r] = { total: 0, complete: 0, awaiting: 0, corrections: 0, cycles: [] });
    allContracts.forEach(c => { const r = rm[c.region]; if (!r) return; r.total++; if (c.status.code === "06") { r.complete++; const ct = daysBetween(c.dates.Date_Rcvd_From_AE, c.dates.Date_Contract_Executed); if (ct) r.cycles.push(ct); } if (c.status.code === "03") r.awaiting++; if (c.status.code === "90") r.corrections++; });
    return Object.entries(rm).map(([reg, d]) => ({ region: reg.split(" - ")[1], regionFull: reg, ...d, avgCycle: d.cycles.length ? Math.round(d.cycles.reduce((a, b) => a + b, 0) / d.cycles.length) : null, pct: d.total ? Math.round((d.complete / d.total) * 100) : 0 }));
  }, [allContracts]);

  // ── Approval flow helpers ──
  const setDate = (f, v) => setContractDates(p => ({ ...p, [selectedContractId]: { ...p[selectedContractId], [f]: v } }));
  const clearDate = (f) => setContractDates(p => { const u = { ...p[selectedContractId] }; delete u[f]; return { ...p, [selectedContractId]: u }; });
  const getAtt = (sid) => attachments[`${selectedContractId}-${sid}`] || [];
  const selectContract = (id) => { setSelectedContractId(id); setExpandedStep(null); setCollapsedPhases({}); };

  const currentPhaseId = useMemo(() => {
    const s = getAutoStatus(dates);
    if (s.code === "06" || s.code === "05") return 4;
    if (s.code === "04") return 3;
    if (s.code === "03") return 2;
    return 1;
  }, [dates]);
  const isPhaseCollapsed = (pid) => collapsedPhases[pid] !== undefined ? collapsedPhases[pid] : pid !== currentPhaseId;
  const togglePhase = (pid) => setCollapsedPhases(p => ({ ...p, [pid]: !isPhaseCollapsed(pid) }));

  const getStepStatus = (step) => {
    if (!step.dateField) { const nx = WORKFLOW_STEPS[WORKFLOW_STEPS.indexOf(step) + 1]; return nx?.dateField && dates[nx.dateField] ? "complete" : "pending"; }
    if (dates[step.dateField]) return "complete";
    const prev = WORKFLOW_STEPS.slice(0, WORKFLOW_STEPS.indexOf(step)).filter(s => s.dateField && s.required);
    if (prev.every(s => dates[s.dateField]) && !step.isOptional && !step.isCorrection) return "current";
    return "pending";
  };

  const handleForward = (step, target) => {
    if (step.dateField && !dates[step.dateField]) setDate(step.dateField, todayStr());
    const tgt = WORKFLOW_STEPS.find(s => s.id === target);
    setActivityLog(p => [{ time: new Date().toISOString().replace("T", " ").slice(0, 16), action: `${step.forwardLabel} → ${tgt ? ROLES[tgt.role].label : target}`, user: actingLabel, contract: contract.contractNum }, ...p]);
    setExpandedStep(target);
    setForwardConfirm(null);
  };

  const handleFileInput = (e) => {
    if (uploadTarget && e.target.files.length) {
      const key = `${selectedContractId}-${uploadTarget}`;
      const newF = Array.from(e.target.files).map(f => ({ name: f.name, size: f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`, date: todayStr(), addedBy: actingLabel }));
      setAttachments(p => ({ ...p, [key]: [...(p[key] || []), ...newF] }));
    }
    setUploadTarget(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: "◉" },
    { id: "contracts", label: "Contracts", icon: "☰" },
    { id: "workflow", label: "Approval Flow", icon: "▸" },
    { id: "turnaround", label: "Turnaround", icon: "⏱" },
    { id: "regional", label: "Regional", icon: "◫" },
    { id: "activity", label: "Activity", icon: "↻" },
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI', -apple-system, sans-serif", background: "#f1f5f9", minHeight: "100vh", color: "#0f172a" }}>
      <input type="file" ref={fileInputRef} style={{ display: "none" }} multiple onChange={handleFileInput} />

      {/* Prototype Banner */}
      <div style={{ background: "#fef2f2", borderBottom: "2px solid #fecaca", padding: "5px 24px", textAlign: "center" }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: "#dc2626", letterSpacing: 0.3 }}>PROTOTYPE — Contract Funding Approval Flow &middot; HUD Multifamily Housing &middot; Attachments, routing &amp; delegation are simulated for demo</span>
      </div>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0c2d6b 0%, #1e40af 50%, #1d4ed8 100%)", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: "#fff" }}>H</div>
          <div>
            <div style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>Funding Workflow Tracker</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>HUD Multifamily Housing</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 1, background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: 2 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setView(n.id)}
              style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 17, fontWeight: 600, background: view === n.id ? "rgba(255,255,255,0.95)" : "transparent", color: view === n.id ? "#1e40af" : "rgba(255,255,255,0.65)" }}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "14px 24px", maxWidth: 1300, margin: "0 auto" }}>

        {/* ═══════════════════════════════════════════════════════════════════
            DASHBOARD
           ═══════════════════════════════════════════════════════════════════ */}
        {view === "dashboard" && (<div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <Metric label="Total Contracts" value={metrics.total} sub="All regions" />
            <Metric label="Avg Cycle Time" value={`${metrics.avgCycle}d`} sub="Target: 60d" accent={metrics.avgCycle > 60 ? "#ef4444" : "#1e40af"} />
            <Metric label="Awaiting Funding" value={metrics.byStatus["03"]} sub="Pending HQ" accent="#f59e0b" />
            <Metric label="In Signature" value={metrics.byStatus["04"]} sub="OA or BC" accent="#a78bfa" />
            <Metric label="Corrections" value={metrics.byStatus["90"]} sub="Returned" accent="#f87171" />
            <Metric label="Completed" value={metrics.completed} sub={`${Math.round(metrics.completed / metrics.total * 100)}%`} accent="#34d399" />
          </div>
          {/* Pipeline */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 18px", marginBottom: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "#1e293b" }}>Funding Request Pipeline</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {STATUS_CODES.filter(s => s.code !== "99").map(s => {
                const ct = metrics.byStatus[s.code]; const pct = Math.round((ct / metrics.total) * 100);
                return (<div key={s.code} onClick={() => { setView("contracts"); }} style={{ flex: `${Math.max(pct, 8)} 0 0`, minWidth: 90, padding: "10px 12px", borderRadius: 10, background: s.color + "12", border: `1px solid ${s.color}33`, cursor: "pointer" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{ct}</div>
                  <div style={{ fontSize: 17, color: s.color, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 24, color: "#94a3b8" }}>{pct}%</div>
                </div>);
              })}
            </div>
          </div>
          {/* Two Column */}
          <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 320, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 18px" }}>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "#1e293b" }}>Avg Turnaround by Stage</div>
              {[{ label: "HQ Funding", days: metrics.avgFund, target: 10, color: "#f59e0b" }, { label: "Owner Signature", days: metrics.avgOA, target: 10, color: "#a78bfa" }, { label: "Branch Chief", days: metrics.avgBC, target: 5, color: "#60a5fa" }, { label: "Fort Worth", days: metrics.avgFW, target: 10, color: "#2dd4bf" }, { label: "End-to-End", days: metrics.avgCycle, target: 60, color: "#1e40af" }].map((item, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 24, color: "#475569" }}>{item.label}</span>
                    <span style={{ fontSize: 24, fontWeight: 700, color: item.days > item.target ? "#ef4444" : "#16a34a" }}>{item.days}d {item.days > item.target ? "⚠" : "✓"}</span>
                  </div>
                  <Bar pct={(item.days / item.target) * 100} color={item.days > item.target ? "#ef4444" : item.color} />
                </div>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 320, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 18px" }}>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "#1e293b" }}>⚠ Needs Attention</div>
              <div style={{ display: "grid", gap: 4 }}>
                {allContracts.filter(c => ["90", "03"].includes(c.status.code) || c.alert.level === "expired" || c.alert.level === "30").slice(0, 6).map(c => (
                  <div key={c.id} onClick={() => { selectContract(c.id); setView("workflow"); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", borderRadius: 8, background: "#fafbfc", border: "1px solid #f1f5f9", cursor: "pointer", fontSize: 14 }}>
                    <div><span style={{ fontWeight: 600, color: "#1e40af" }}>{c.contractNum}</span> <span style={{ color: "#94a3b8", marginLeft: 6 }}>{c.propName}</span></div>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>)}

        {/* ═══════════════════════════════════════════════════════════════════
            CONTRACTS LIST
           ═══════════════════════════════════════════════════════════════════ */}
        {view === "contracts" && (<div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "10px 14px" }}>
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search contract, property, AE..." style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 11, width: 220, outline: "none" }} />
            <Sel value={filterProgram} onChange={e => setFilterProgram(e.target.value)}><option value="All">All Programs</option>{PROGRAMS.map(p => <option key={p}>{p}</option>)}</Sel>
            <Sel value={filterRegion} onChange={e => setFilterRegion(e.target.value)}><option value="All">All Regions</option>{REGIONS.map(r => <option key={r} value={r}>{r}</option>)}</Sel>
            <Sel value={filterAlert} onChange={e => setFilterAlert(e.target.value)}><option value="All">All Alerts</option><option value="expired">🔴 Expired</option><option value="30">🔴 ≤30d</option><option value="60">🟠 ≤60d</option><option value="90">🟡 ≤90d</option><option value="120">🔵 ≤120d</option><option value="none">🟢 &gt;120d</option></Sel>
            <span style={{ fontSize: 11, color: "#64748b" }}><strong>{filtered.length}</strong> of {metrics.total}</span>
            <button onClick={() => setShowNewForm(true)} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 8, border: "none", background: "#1e40af", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ New Contract</button>
          </div>

          {/* Contract Detail Panel */}
          {selectedDetail && (() => { const c = selectedDetail; const d = contractDates[c.id] || {}; const st = getAutoStatus(d); const al = getExpirationAlert(c.contractExpiration); const timeline = [
            { phase: "INITIAL", label: "Documentation from AE", sent: null, rcvd: d.Date_Rcvd_From_AE },
            { phase: "FUNDING", label: "Funding Request to HQ", sent: d.Date_Sent_Fund_Req, rcvd: d.Date_Fund_Rcvd_1 },
            { phase: "SIGNATURE", label: "Owner/Agent Signature", sent: d.Date_Sent_OA_Sign, rcvd: d.Date_Rcvd_OA_Sign },
            { phase: "SIGNATURE", label: "Branch Chief Review", sent: d.Date_Sent_BC_Sign, rcvd: d.Date_Rcvd_BC_Sign },
            { phase: "PROCESSING", label: "Fort Worth Processing", sent: d.Date_Sent_FW, rcvd: d.Date_FW_Complete },
            { phase: "COMPLETE", label: "Contract Executed", sent: null, rcvd: d.Date_Contract_Executed },
          ]; return (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 18, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{c.contractNum} — {c.propName}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{c.fhaNum} &middot; {c.region} &middot; {c.units} units &middot; ${c.monthlyHAP.toLocaleString()}/mo &middot; {c.renewalOption}</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Pill color={al.color} bg={al.bg}>{al.icon} {al.label}</Pill>
                  <StatusBadge status={st} />
                  <button onClick={() => setSelectedDetail(null)} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 11, color: "#64748b" }}>✕</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 14, padding: "10px 0", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                {[["Program", c.program], ["Account Executive", c.ae], ["Branch Chief", c.branchChief], ["Funding Specialist", c.fundingSpec], ["Contract Expiration", c.contractExpiration]].map(([l, v], i) => (
                  <div key={i}><div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</div><div style={{ fontSize: 12, fontWeight: 600, marginTop: 1 }}>{v}</div></div>
                ))}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Workflow Timeline</div>
              {timeline.map((s, i) => { const ta = (s.sent && s.rcvd) ? daysBetween(s.sent, s.rcvd) : null; const active = s.sent && !s.rcvd; const done = !!s.rcvd; const pCol = { INITIAL: "#60a5fa", FUNDING: "#f59e0b", SIGNATURE: "#a78bfa", PROCESSING: "#2dd4bf", COMPLETE: "#34d399" }[s.phase]; return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px 80px 55px", padding: "6px 10px", borderRadius: 6, alignItems: "center", background: active ? "#fffbeb" : done ? "#f0fdf4" : "#fafbfc", border: active ? "1px solid #fde68a" : "1px solid transparent", marginBottom: 2 }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: pCol, textTransform: "uppercase" }}>{s.phase}</span>
                  <span style={{ fontSize: 11, color: done ? "#1e293b" : "#94a3b8", fontWeight: done ? 600 : 400 }}>{done ? "✓" : active ? "●" : "○"} {s.label}</span>
                  <span style={{ fontSize: 10, color: "#64748b" }}>{s.sent || "—"}</span>
                  <span style={{ fontSize: 10, color: "#64748b" }}>{s.rcvd || (active ? <span style={{ color: "#f59e0b", fontWeight: 600 }}>Pending</span> : "—")}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, textAlign: "right", color: ta != null ? (ta > 14 ? "#ef4444" : "#16a34a") : "#cbd5e1" }}>{ta != null ? `${ta}d` : active ? "⏳" : "—"}</span>
                </div>
              ); })}
              {d.Date_Rcvd_From_AE && d.Date_Contract_Executed && <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 11, fontWeight: 600, color: "#1e40af" }}>Total Cycle Time</span><span style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>{daysBetween(d.Date_Rcvd_From_AE, d.Date_Contract_Executed)} days</span></div>}
              <div style={{ marginTop: 10 }}><button onClick={() => { selectContract(c.id); setView("workflow"); setSelectedDetail(null); }} style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: "#1e40af", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Open Approval Flow →</button></div>
            </div>
          ); })()}

          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 80px 110px 90px 80px 150px", padding: "8px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8 }}>
              <div>Contract</div><div>Property</div><div>Program</div><div>Region</div><div>AE</div><div>Alert</div><div>Status</div>
            </div>
            <div style={{ maxHeight: 480, overflowY: "auto" }}>
              {filtered.map(c => (
                <div key={c.id} onClick={() => setSelectedDetail(c)}
                  style={{ display: "grid", gridTemplateColumns: "110px 1fr 80px 110px 90px 80px 150px", padding: "8px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 11, cursor: "pointer", alignItems: "center", background: selectedDetail?.id === c.id ? "#eff6ff" : "transparent" }}
                  onMouseEnter={e => { if (selectedDetail?.id !== c.id) e.currentTarget.style.background = "#f8fafc"; }} onMouseLeave={e => { if (selectedDetail?.id !== c.id) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ fontWeight: 600, color: "#1e40af" }}>{c.contractNum}</div>
                  <div style={{ color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.propName}</div>
                  <div style={{ color: "#64748b" }}>{c.program}</div>
                  <div style={{ color: "#64748b" }}>{c.region.split(" - ")[1]}</div>
                  <div style={{ color: "#64748b" }}>{c.ae}</div>
                  <div><span style={{ fontSize: 10, color: c.alert.color, fontWeight: 600 }}>{c.alert.icon} {c.alert.label}</span></div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          </div>

          {/* New Contract Modal */}
          {showNewForm && (<div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setShowNewForm(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: 480, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>New Contract</div>
              <div style={{ display: "grid", gap: 10 }}>
                {[["Contract Number", "contractNum", "HAP-XXXXX"], ["FHA Number", "fhaNum", "000-00000"], ["Property Name", "propName", "Property name"]].map(([label, field, ph]) => (
                  <div key={field}><div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 3 }}>{label}</div><input placeholder={ph} value={newForm[field]} onChange={e => setNewForm(p => ({ ...p, [field]: e.target.value }))} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, outline: "none" }} /></div>
                ))}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div><div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 3 }}>Program</div><Sel value={newForm.program} onChange={e => setNewForm(p => ({ ...p, program: e.target.value }))} style={{ width: "100%" }}>{PROGRAMS.map(p => <option key={p}>{p}</option>)}</Sel></div>
                  <div><div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 3 }}>Region</div><Sel value={newForm.region} onChange={e => setNewForm(p => ({ ...p, region: e.target.value }))} style={{ width: "100%" }}>{REGIONS.map(r => <option key={r} value={r}>{r.split(" - ")[1]}</option>)}</Sel></div>
                </div>
                {newForm.program === "Section 8" && <div><div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 3 }}>Renewal Option</div><Sel value={newForm.renewalOption} onChange={e => setNewForm(p => ({ ...p, renewalOption: e.target.value }))} style={{ width: "100%" }}>{RENEWAL_OPTS_S8.map(o => <option key={o}>{o}</option>)}</Sel></div>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div><div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 3 }}>Units</div><input type="number" value={newForm.units} onChange={e => setNewForm(p => ({ ...p, units: e.target.value }))} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, outline: "none" }} /></div>
                  <div><div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 3 }}>Monthly HAP ($)</div><input type="number" value={newForm.monthlyHAP} onChange={e => setNewForm(p => ({ ...p, monthlyHAP: e.target.value }))} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, outline: "none" }} /></div>
                  <div><div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 3 }}>Expiration</div><input type="date" value={newForm.contractExpiration} onChange={e => setNewForm(p => ({ ...p, contractExpiration: e.target.value }))} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, outline: "none" }} /></div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
                <button onClick={() => setShowNewForm(false)} style={{ padding: "7px 18px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, cursor: "pointer", color: "#64748b" }}>Cancel</button>
                <button onClick={handleNewContract} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "#1e40af", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Create Contract</button>
              </div>
            </div>
          </div>)}
        </div>)}

        {/* ═══════════════════════════════════════════════════════════════════
            APPROVAL FLOW
           ═══════════════════════════════════════════════════════════════════ */}
        {view === "workflow" && (<div>
          {/* Workflow filter bar */}
          <div style={{ background: "linear-gradient(180deg, #dbeafe 0%, #eff6ff 100%)", borderRadius: 12, border: "1px solid #bfdbfe", padding: "9px 14px", marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Sel value={filterProgram} onChange={e => setFilterProgram(e.target.value)} style={{ borderColor: "#93c5fd" }}><option value="All">All Programs</option>{PROGRAMS.map(p => <option key={p}>{p}</option>)}</Sel>
            <Sel value={filterAlert} onChange={e => setFilterAlert(e.target.value)} style={{ borderColor: "#93c5fd" }}><option value="All">All Alerts</option><option value="expired">🔴 Expired</option><option value="30">🔴 ≤30d</option><option value="60">🟠 ≤60d</option><option value="90">🟡 ≤90d</option><option value="120">🔵 ≤120d</option><option value="none">🟢 &gt;120d</option></Sel>
            <Sel value={selectedContractId} onChange={e => selectContract(Number(e.target.value))} style={{ minWidth: 250, borderColor: "#93c5fd" }}>
              {filtered.map(c => <option key={c.id} value={c.id}>{c.contractNum} — {c.propName} [{c.program}] {c.alert.icon}</option>)}
              {filtered.length === 0 && <option disabled>No matches</option>}
            </Sel>
            <div style={{ width: 1, height: 24, background: "#93c5fd" }} />
            <Sel value={actingAs} onChange={e => setActingAs(e.target.value)} style={{ minWidth: 190, borderColor: actingAs !== "self" ? "#f59e0b" : "#93c5fd", background: actingAs !== "self" ? "#fffbeb" : "#fff" }}>
              <option value="self">— My Actions —</option>
              <optgroup label="Branch Chiefs">{STAFF.filter(s => s.role === "Branch Chief").map(s => <option key={s.id} value={s.id}>{s.name} — BC ({s.region})</option>)}</optgroup>
              <optgroup label="Account Executives">{STAFF.filter(s => s.role === "Account Executive").map(s => <option key={s.id} value={s.id}>{s.name} — AE ({s.region})</option>)}</optgroup>
              <optgroup label="Funding Specialists">{STAFF.filter(s => s.role === "Funding Specialist").map(s => <option key={s.id} value={s.id}>{s.name} — Fund ({s.region})</option>)}</optgroup>
            </Sel>
            {actingAs !== "self" && <span style={{ fontSize: 17, color: "#92400e", fontWeight: 600, background: "#fef3c7", padding: "3px 8px", borderRadius: 6 }}>⚠ Acting as {actingStaff.name} <button onClick={() => setActingAs("self")} style={{ border: "none", background: "none", color: "#92400e", cursor: "pointer", fontWeight: 800 }}>✕</button></span>}
            <label style={{ marginLeft: "auto", fontSize: 17, color: "#1e40af", display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }}><input type="checkbox" checked={showProgramNotes} onChange={e => setShowProgramNotes(e.target.checked)} /> Program notes</label>
          </div>

          {/* Contract card */}
          {contract && (<>
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "12px 18px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 6 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{contract.contractNum} — {contract.propName}</div>
                <div style={{ fontSize: 17, color: "#64748b", marginTop: 2 }}>{contract.fhaNum} &middot; {contract.region} &middot; {contract.units} units &middot; ${contract.monthlyHAP.toLocaleString()}/mo</div>
                <div style={{ fontSize: 17, color: "#475569", marginTop: 3 }}>👤 AE: <strong>{contract.ae}</strong> &nbsp; ✍ BC: <strong>{contract.branchChief}</strong> &nbsp; 💰 Funding: <strong>{contract.fundingSpec}</strong></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                <div style={{ display: "flex", gap: 5 }}>
                  <Pill color={contract.program === "Section 8" ? "#1e40af" : "#7c3aed"}>{contract.program}</Pill>
                  <StatusBadge status={contract.status} />
                </div>
                <Pill color={contract.alert.color} bg={contract.alert.bg}>{contract.alert.icon} {contract.alert.label}</Pill>
              </div>
            </div>
            <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
              {PHASES.map(p => { const ps = WORKFLOW_STEPS.filter(s => s.phase === p.id && s.dateField && !s.isCorrection); const dn = ps.filter(s => dates[s.dateField]).length; return (
                <div key={p.id} style={{ flex: 1 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}><span style={{ fontSize: 17, fontWeight: 700, color: p.color, textTransform: "uppercase" }}>P{p.id}</span><span style={{ fontSize: 17, color: "#94a3b8" }}>{dn}/{ps.length}</span></div><Bar pct={ps.length ? (dn / ps.length) * 100 : 0} color={p.color} /></div>
              ); })}
            </div>
          </div>

          {/* Phases */}
          <div style={{ marginLeft: 14, paddingLeft: 14, borderLeft: "3px solid #bfdbfe" }}>
            {PHASES.map(phase => {
              const steps = WORKFLOW_STEPS.filter(s => s.phase === phase.id);
              const collapsed = isPhaseCollapsed(phase.id);
              const allDone = steps.filter(s => s.dateField && !s.isCorrection).every(s => dates[s.dateField]);
              const noStart = !steps.some(s => s.dateField && dates[s.dateField]);
              const hasActive = phase.id === currentPhaseId;
              const doneCt = steps.filter(s => s.dateField && dates[s.dateField]).length;
              const totalCt = steps.filter(s => s.dateField).length;

              return (<div key={phase.id} style={{ marginBottom: 10 }}>
                <div onClick={() => togglePhase(phase.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 10, background: phase.bg, border: `1px solid ${phase.border}`, cursor: "pointer" }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: allDone ? "#16a34a" : phase.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 17, fontWeight: 700 }}>{allDone ? "✓" : phase.id}</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: allDone ? "#16a34a" : phase.color }}>{phase.name}</span>
                  {collapsed && <span style={{ fontSize: 17, marginLeft: 6, color: allDone ? "#16a34a" : noStart ? "#94a3b8" : hasActive ? "#fff" : "#d97706", fontWeight: 600, ...(hasActive && !allDone ? { background: phase.color, padding: "1px 7px", borderRadius: 10 } : {}) }}>
                    {allDone ? "All complete" : noStart ? "Not started" : hasActive ? "● Active" : `${doneCt}/${totalCt}`}
                  </span>}
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 24, color: phase.color, opacity: 0.6 }}>{doneCt}/{totalCt}</span>
                    <span style={{ fontSize: 17, color: phase.color, opacity: 0.5, transform: collapsed ? "none" : "rotate(90deg)", transition: "transform 0.15s" }}>▸</span>
                  </div>
                </div>

                {!collapsed && <div style={{ display: "grid", gap: 2, paddingLeft: 12, marginTop: 3 }}>
                  {steps.map(step => {
                    const ss = getStepStatus(step); const isExp = expandedStep === step.id; const done = ss === "complete"; const cur = ss === "current"; const att = getAtt(step.id); const nxt = step.forwardTo ? WORKFLOW_STEPS.find(s => s.id === step.forwardTo) : null;
                    return (<div key={step.id} style={{ borderRadius: 8, border: cur ? `2px solid ${phase.color}` : done ? "1px solid #d1fae5" : "1px solid #e2e8f0", background: cur ? phase.bg : done ? "#f0fdf4" : "#fff", boxShadow: cur ? `0 0 0 2px ${phase.color}22` : "none", opacity: step.isOptional && !dates[step.dateField] ? 0.5 : step.isCorrection && !dates[step.dateField] ? 0.5 : 1 }}>
                      <div onClick={() => setExpandedStep(isExp ? null : step.id)} style={{ display: "grid", gridTemplateColumns: "42px 68px 1fr auto 100px 20px", padding: "6px 12px", alignItems: "center", gap: 6, cursor: "pointer" }}>
                        <span style={{ fontSize: 17, fontWeight: 700, color: done ? "#16a34a" : cur ? phase.color : "#94a3b8" }}>{done ? "✓" : cur ? "●" : "○"} {step.id}</span>
                        <RoleBadge roleKey={step.role} />
                        <div>
                          <span style={{ fontSize: 24, fontWeight: done || cur ? 600 : 400, color: done ? "#166534" : cur ? "#1e293b" : "#64748b" }}>{step.label}</span>
                          {step.isDecision && <span style={{ marginLeft: 5, fontSize: 17, color: "#d97706", fontWeight: 700 }}>◆ DECISION</span>}
                          {step.isCorrection && <span style={{ marginLeft: 5, fontSize: 17, color: "#dc2626", fontWeight: 700 }}>↩ CORRECTION</span>}
                          {step.isFinal && <span style={{ marginLeft: 5, fontSize: 17, color: "#059669", fontWeight: 700 }}>★ FINAL</span>}
                        </div>
                        {att.length > 0 ? <span style={{ fontSize: 24, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: "#e0f2fe", color: "#0369a1" }}>📎{att.length}</span> : <span />}
                        <div style={{ textAlign: "right" }}>{step.dateField && dates[step.dateField] ? <span style={{ fontSize: 17, fontWeight: 600, color: "#16a34a" }}>{dates[step.dateField]}</span> : step.dateField ? <span style={{ fontSize: 24, color: cur ? phase.color : "#cbd5e1" }}>{cur ? "⏳ Awaiting" : "—"}</span> : null}</div>
                        <span style={{ fontSize: 17, color: "#94a3b8", transform: isExp ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▸</span>
                      </div>

                      {isExp && (<div style={{ borderTop: "1px solid #e2e8f0", background: "#fafbfc", padding: "10px 14px 10px 50px" }}>
                        <div style={{ fontSize: 24, color: "#475569", lineHeight: 1.5, marginBottom: 8 }}>{step.description}</div>
                        {showProgramNotes && step.programNote && step.programNote !== "BOTH" && <div style={{ fontSize: 17, color: "#92400e", background: "#fef3c7", padding: "6px 10px", borderRadius: 6, marginBottom: 8, border: "1px solid #fde68a", whiteSpace: "pre-line" }}>⚙ {step.programNote}</div>}
                        {step.dateField && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                          <span style={{ fontSize: 24, fontFamily: "monospace", background: "#f1f5f9", padding: "2px 5px", borderRadius: 4, color: "#64748b" }}>{step.dateField}</span>
                          <input type="date" value={dates[step.dateField] || ""} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); setDate(step.dateField, e.target.value); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 24, outline: "none" }} />
                          {dates[step.dateField] && <button onClick={e => { e.stopPropagation(); clearDate(step.dateField); }} style={{ padding: "2px 7px", borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 24, cursor: "pointer" }}>Clear</button>}
                          {step.dateField === "Date_Fund_Rcvd_1" && dates.Date_Sent_Fund_Req && dates.Date_Fund_Rcvd_1 && <span style={{ fontSize: 17, color: "#1e40af", fontWeight: 600 }}>⏱ {daysBetween(dates.Date_Sent_Fund_Req, dates.Date_Fund_Rcvd_1)}d</span>}
                          {step.dateField === "Date_Rcvd_OA_Sign" && dates.Date_Sent_OA_Sign && dates.Date_Rcvd_OA_Sign && <span style={{ fontSize: 17, color: "#7c3aed", fontWeight: 600 }}>⏱ {daysBetween(dates.Date_Sent_OA_Sign, dates.Date_Rcvd_OA_Sign)}d</span>}
                          {step.dateField === "Date_Rcvd_BC_Sign" && dates.Date_Sent_BC_Sign && dates.Date_Rcvd_BC_Sign && <span style={{ fontSize: 17, color: "#059669", fontWeight: 600 }}>⏱ {daysBetween(dates.Date_Sent_BC_Sign, dates.Date_Rcvd_BC_Sign)}d</span>}
                          {step.dateField === "Date_FW_Complete" && dates.Date_Sent_FW && dates.Date_FW_Complete && <span style={{ fontSize: 17, color: "#7c3aed", fontWeight: 600 }}>⏱ {daysBetween(dates.Date_Sent_FW, dates.Date_FW_Complete)}d</span>}
                          {step.isFinal && dates.Date_Rcvd_From_AE && dates.Date_Contract_Executed && <span style={{ fontSize: 24, color: "#047857", fontWeight: 700, padding: "2px 8px", background: "#d1fae5", borderRadius: 6 }}>🏁 {daysBetween(dates.Date_Rcvd_From_AE, dates.Date_Contract_Executed)}d total</span>}
                        </div>}
                        {/* Attachments */}
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}><span style={{ fontSize: 17, fontWeight: 700, color: "#475569" }}>📎 Attachments ({att.length})</span><button onClick={e => { e.stopPropagation(); setUploadTarget(step.id); fileInputRef.current?.click(); }} style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", fontSize: 24, fontWeight: 700, cursor: "pointer" }}>+ Attach</button></div>
                          {att.map((a, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 5, background: "#fff", border: "1px solid #e2e8f0", marginBottom: 2, fontSize: 13 }}><span>{fileIcon(a.name)}</span><span style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span><span style={{ color: "#94a3b8", fontSize: 12 }}>{a.size} &middot; {a.date}</span><button onClick={e => { e.stopPropagation(); const k = `${selectedContractId}-${step.id}`; setAttachments(p => ({ ...p, [k]: (p[k] || []).filter((_, j) => j !== i) })); }} style={{ border: "none", background: "none", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>✕</button></div>))}
                          {att.length === 0 && <div style={{ fontSize: 17, color: "#94a3b8", fontStyle: "italic" }}>No attachments</div>}
                        </div>
                        {/* Notes */}
                        <textarea placeholder="Notes..." value={notes[`${selectedContractId}-${step.id}`] || ""} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); setNotes(p => ({ ...p, [`${selectedContractId}-${step.id}`]: e.target.value })); }} style={{ width: "100%", padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 17, fontFamily: "inherit", resize: "vertical", minHeight: 26, outline: "none" }} />
                        {/* Forward */}
                        {step.forwardTo && !step.isFinal && (<div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {forwardConfirm === `${step.id}-f` ? (<><button onClick={e => { e.stopPropagation(); handleForward(step, step.forwardTo); }} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: phase.color, color: "#fff", fontSize: 17, fontWeight: 700, cursor: "pointer" }}>✓ Confirm</button><button onClick={e => { e.stopPropagation(); setForwardConfirm(null); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 17, cursor: "pointer" }}>Cancel</button></>
                          ) : (<button onClick={e => { e.stopPropagation(); setForwardConfirm(`${step.id}-f`); }} style={{ padding: "4px 12px", borderRadius: 8, border: "none", background: cur ? phase.color : "#e2e8f0", color: cur ? "#fff" : "#475569", fontSize: 17, fontWeight: 700, cursor: "pointer", boxShadow: cur ? `0 2px 6px ${phase.color}44` : "none" }}>{step.forwardLabel} → {nxt && <RoleBadge roleKey={nxt.role} />}</button>)}
                          {step.altForwardTo && (<>{forwardConfirm === `${step.id}-a` ? (<><button onClick={e => { e.stopPropagation(); handleForward(step, step.altForwardTo); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontSize: 17, fontWeight: 700, cursor: "pointer" }}>✓ Confirm</button><button onClick={e => { e.stopPropagation(); setForwardConfirm(null); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 17, cursor: "pointer", color: "#64748b" }}>Cancel</button></>) : (<button onClick={e => { e.stopPropagation(); setForwardConfirm(`${step.id}-a`); }} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 17, fontWeight: 600, cursor: "pointer" }}>{step.altForwardLabel} ↩</button>)}</>)}
                          {actingAs !== "self" && <span style={{ fontSize: 24, color: "#92400e", fontStyle: "italic" }}>as {actingStaff.name}</span>}
                        </div>)}
                        {step.isFinal && dates.Date_Contract_Executed && <div style={{ marginTop: 8, padding: "8px", borderRadius: 6, background: "#f0fdf4", textAlign: "center", border: "1px solid #bbf7d0" }}><span style={{ fontSize: 24, fontWeight: 700, color: "#047857" }}>🎉 Complete — {daysBetween(dates.Date_Rcvd_From_AE, dates.Date_Contract_Executed)}d cycle</span></div>}
                      </div>)}
                    </div>);
                  })}
                </div>}
              </div>);
            })}
          </div>
          </>)}
        </div>)}

        {/* ═══════════════════════════════════════════════════════════════════
            TURNAROUND
           ═══════════════════════════════════════════════════════════════════ */}
        {view === "turnaround" && (<div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <Metric label="Avg HQ Funding" value={`${metrics.avgFund}d`} sub="Target: 10d" accent={metrics.avgFund > 10 ? "#ef4444" : "#16a34a"} />
            <Metric label="Avg OA Signature" value={`${metrics.avgOA}d`} sub="Target: 10d" accent={metrics.avgOA > 10 ? "#ef4444" : "#16a34a"} />
            <Metric label="Avg BC Review" value={`${metrics.avgBC}d`} sub="Target: 5d" accent={metrics.avgBC > 5 ? "#ef4444" : "#16a34a"} />
            <Metric label="Avg FW Processing" value={`${metrics.avgFW}d`} sub="Target: 10d" accent={metrics.avgFW > 10 ? "#ef4444" : "#16a34a"} />
            <Metric label="Avg Total Cycle" value={`${metrics.avgCycle}d`} sub="Target: 60d" accent={metrics.avgCycle > 60 ? "#ef4444" : "#16a34a"} />
          </div>
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 18px", marginBottom: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Bottleneck Identification</div>
            {[{ stage: "HQ Funding", avg: metrics.avgFund, target: 10, color: "#f59e0b" }, { stage: "Owner Signature", avg: metrics.avgOA, target: 10, color: "#a78bfa" }, { stage: "Branch Chief", avg: metrics.avgBC, target: 5, color: "#60a5fa" }, { stage: "Fort Worth", avg: metrics.avgFW, target: 10, color: "#2dd4bf" }].sort((a, b) => b.avg - a.avg).map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ width: 150, fontSize: 24, color: "#475569" }}>{item.stage}</div>
                <div style={{ flex: 1 }}><Bar pct={(item.avg / 30) * 100} color={item.avg > item.target ? "#ef4444" : item.color} /></div>
                <div style={{ width: 50, textAlign: "right", fontSize: 24, fontWeight: 700, color: item.avg > item.target ? "#ef4444" : "#16a34a" }}>{item.avg}d</div>
                <div style={{ width: 55, textAlign: "right", fontSize: 24, color: "#94a3b8" }}>target: {item.target}d</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 18px" }}>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Longest Processing Contracts</div>
            {allContracts.filter(c => c.dates.Date_Rcvd_From_AE && c.dates.Date_Contract_Executed).map(c => ({ ...c, days: daysBetween(c.dates.Date_Rcvd_From_AE, c.dates.Date_Contract_Executed) })).sort((a, b) => b.days - a.days).slice(0, 6).map(c => (
              <div key={c.id} onClick={() => { selectContract(c.id); setView("workflow"); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderRadius: 8, marginBottom: 3, cursor: "pointer", background: "#fafbfc", border: "1px solid #f1f5f9", fontSize: 14 }}>
                <div><span style={{ fontWeight: 600, color: "#1e40af" }}>{c.contractNum}</span> <span style={{ color: "#94a3b8", marginLeft: 6 }}>{c.propName}</span></div>
                <span style={{ fontWeight: 700, color: c.days > 60 ? "#ef4444" : "#f59e0b" }}>{c.days}d</span>
              </div>
            ))}
          </div>
        </div>)}

        {/* ═══════════════════════════════════════════════════════════════════
            REGIONAL
           ═══════════════════════════════════════════════════════════════════ */}
        {view === "regional" && (<div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 14 }}>Cross-Regional Performance</div>
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "120px 55px 55px 75px 80px 80px 1fr", padding: "8px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 24, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.7 }}>
              <div>Region</div><div>Total</div><div>Done</div><div>Awaiting</div><div>Corrections</div><div>Avg Cycle</div><div>Completion</div>
            </div>
            {regionMetrics.sort((a, b) => b.pct - a.pct).map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 55px 55px 75px 80px 80px 1fr", padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 24, alignItems: "center" }}>
                <div style={{ fontWeight: 600 }}>{r.region}</div>
                <div>{r.total}</div>
                <div style={{ color: "#16a34a", fontWeight: 600 }}>{r.complete}</div>
                <div style={{ color: r.awaiting > 1 ? "#f59e0b" : "#64748b", fontWeight: r.awaiting > 1 ? 600 : 400 }}>{r.awaiting}</div>
                <div style={{ color: r.corrections > 0 ? "#ef4444" : "#64748b", fontWeight: r.corrections > 0 ? 600 : 400 }}>{r.corrections}</div>
                <div style={{ fontWeight: 700, color: r.avgCycle === null ? "#94a3b8" : r.avgCycle > 60 ? "#ef4444" : "#16a34a" }}>{r.avgCycle != null ? `${r.avgCycle}d` : "—"}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Bar pct={r.pct} color={r.pct > 50 ? "#34d399" : r.pct > 25 ? "#f59e0b" : "#ef4444"} /><span style={{ fontSize: 17, fontWeight: 600, minWidth: 28 }}>{r.pct}%</span></div>
              </div>
            ))}
          </div>
        </div>)}

        {/* ═══════════════════════════════════════════════════════════════════
            ACTIVITY LOG
           ═══════════════════════════════════════════════════════════════════ */}
        {view === "activity" && (<div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 14 }}>Activity Log — All Routing Actions</div>
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16 }}>
            {activityLog.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 15 }}>No activity yet.</div>}
            {activityLog.map((e, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 90px 1fr 170px", padding: "6px 12px", borderRadius: 6, background: "#fafbfc", border: "1px solid #f1f5f9", marginBottom: 3, fontSize: 24, alignItems: "center", gap: 6 }}>
                <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: 13 }}>{e.time}</span>
                <span style={{ fontWeight: 600, color: "#1e40af" }}>{e.contract}</span>
                <span>{e.action}</span>
                <span style={{ color: e.user.includes("acting") ? "#92400e" : "#64748b", textAlign: "right", fontWeight: e.user.includes("acting") ? 600 : 400 }}>{e.user}</span>
              </div>
            ))}
          </div>
        </div>)}

        <div style={{ textAlign: "center", padding: "14px 0 6px", fontSize: 24, color: "#94a3b8" }}>HUD Multifamily Housing &middot; Funding Workflow Tracker</div>
      </div>
    </div>
  );
}

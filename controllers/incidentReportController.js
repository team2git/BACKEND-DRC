import IncidentReport from '../models/IncidentReport.js';
import * as auditService from '../services/auditService.js';

const sanitizeIncomingPayload = (payload) => {
  const clean = payload && typeof payload === 'object' ? { ...payload } : {};
  delete clean._id;
  delete clean.createdAt;
  delete clean.updatedAt;
  delete clean.reportCode;
  return clean;
};

const generateReportCode = () => {
  return String(Math.floor(1000 + Math.random() * 9000));
};

const normalizeStatus = (incoming) => {
  if (!incoming) return undefined;
  const s = String(incoming).toLowerCase().trim();
  if (s === 'solved' || s.includes('solv')) return 'closed';
  if (s === 'not solved' || s === 'not_solved' || s.includes('not')) return 'submitted';
  // allow existing backend statuses if provided
  const allowed = ['submitted', 'received', 'dispatched', 'closed'];
  if (allowed.includes(s)) return s;
  return undefined;
};

// Public: create an incident report
// POST /api/incident-reports
export const createIncidentReportPublic = async (req, res) => {
  try {
    const payload = sanitizeIncomingPayload(req.body || {});

    const reportType = (payload.reportType || 'incident').toString().trim();
    const category = (payload.category || '').toString().trim();
    const concernCategory = (payload.concernCategory || '').toString().trim();
    const severity = (payload.severity || '').toString().trim();
    const details = (payload.details || '').toString().trim();
    const concernDetails = (payload.concernDetails || '').toString().trim();

    if (reportType !== 'incident' && reportType !== 'concern') {
      return res.status(400).json({ message: 'Report type must be incident or concern' });
    }
    if (reportType === 'incident') {
      if (!category) {
        return res.status(400).json({ message: 'Incident category is required' });
      }
      if (!severity) {
        return res.status(400).json({ message: 'Severity is required' });
      }
      if (!details) {
        return res.status(400).json({ message: 'Details are required' });
      }
    } else {
      if (!concernCategory) {
        return res.status(400).json({ message: 'Concern category is required' });
      }
      if (!concernDetails) {
        return res.status(400).json({ message: 'Concern details are required' });
      }
    }

    let reportCode = generateReportCode();
    let attempts = 0;
    while (attempts < 3) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await IncidentReport.findOne({ reportCode }).lean();
      if (!existing) break;
      reportCode = generateReportCode();
      attempts += 1;
    }

    const doc = await IncidentReport.create({
      ...payload,
      ...(payload.status ? { status: normalizeStatus(payload.status) } : {}),
      reportCode,
      ...(req.user?._id ? { createdByUser: req.user._id, lastUpdatedByUser: req.user._id } : {}),
    });

    await auditService.logAction({
        userId: req.user?._id || 'PUBLIC_USER',
        action: 'INCIDENT_REPORT_CREATE',
        resource: 'IncidentReport',
        resourceId: doc._id,
        after: doc,
        ip: req.ip
    });

    res.status(201).json(doc);
  } catch (error) {
    console.error('createIncidentReportPublic error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin: list incident reports
// GET /api/incident-reports
export const listIncidentReports = async (req, res) => {
  try {
    const { status, search, category, severity, reportType, concernCategory } = req.query;
    const query = { ...(req.dataScope || {}) };
    if (status) query.status = status;
    if (reportType) query.reportType = reportType;
    if (category) query.category = category;
    if (concernCategory) query.concernCategory = concernCategory;
    if (severity) query.severity = severity;
    if (search) {
      const searchOr = [
        { reportCode: { $regex: search, $options: 'i' } },
        { reportType: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { concernCategory: { $regex: search, $options: 'i' } },
        { severity: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
        { concernDetails: { $regex: search, $options: 'i' } },
        { 'location.addressLine': { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } },
        { 'location.region': { $regex: search, $options: 'i' } },
        { 'location.placeName': { $regex: search, $options: 'i' } },
        { 'location.subCity': { $regex: search, $options: 'i' } },
        { 'location.woreda': { $regex: search, $options: 'i' } },
      ];
      // Merge search $or with any existing dataScope $or using $and to avoid collision
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const docs = await IncidentReport.find(query).sort({ updatedAt: -1 }).lean();
    res.json(docs);
  } catch (error) {
    console.error('listIncidentReports error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin: get single report
// GET /api/incident-reports/:id
export const getIncidentReportById = async (req, res) => {
  try {
    const doc = await IncidentReport.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Report not found' });
    res.json(doc);
  } catch (error) {
    console.error('getIncidentReportById error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin: update report
// PUT /api/incident-reports/:id
export const updateIncidentReport = async (req, res) => {
  try {
    const payload = sanitizeIncomingPayload(req.body || {});
    const beforeDoc = await IncidentReport.findById(req.params.id);
    if (!beforeDoc) return res.status(404).json({ message: 'Report not found' });
    const before = beforeDoc.toObject();
    // Determine if requester is admin/superuser
    const isAdmin = req.user && (req.user.accessLevel === 'super_admin' || (req.user.roles && req.user.roles.some(r => ['superadmin','super admin','super_admin','admin','administrator','branch_admin','manager'].includes((r.name || '').toString().toLowerCase()))));

    // Prevent non-admins from changing protected fields
    if (!isAdmin) {
      delete payload.status;
      delete payload.resolvedAt;
      delete payload.resolvedBy;
      delete payload.resolutionDescription;
      delete payload.resolutionNotes;
    }
    const doc = await IncidentReport.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true }
    );

    await auditService.logAction({
        userId: req.user?._id,
        action: 'INCIDENT_REPORT_UPDATE',
        resource: 'IncidentReport',
        resourceId: doc._id,
        before,
        after: doc,
        ip: req.ip
    });

    res.json(doc);
  } catch (error) {
    console.error('updateIncidentReport error:', error);
    res.status(500).json({ message: error.message });
  }
};

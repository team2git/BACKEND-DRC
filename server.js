import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import sectorRoutes from './routes/sectorRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import rolePermissionRoutes from './routes/rolePermissionRoutes.js';
import hierarchyRoutes from './routes/hierarchyRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import liveDashboardRoutes from './routes/liveDashboardRoutes.js';
import templateRoutes from './routes/templateRoutes.js';
import formResponseRoutes from './routes/formResponseRoutes.js';
import woredaProfileRoutes from './routes/woredaProfileRoutes.js';
import householdProfileRoutes from './routes/householdProfileRoutes.js';
import woredaAssessmentRoutes from './routes/woredaAssessmentRoutes.js';
import profileMappingRoutes from './routes/profileMappingRoutes.js';
import portalContentRoutes from './routes/portalContentRoutes.js';
import incidentReportRoutes from './routes/incidentReportRoutes.js';
import alertSubscriptionRoutes from './routes/alertSubscriptionRoutes.js';
import emergencyContactRoutes from './routes/emergencyContactRoutes.js';
import inspectionRequestRoutes from './routes/inspectionRequestRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import newsRoutes from './routes/newsRoutes.js';
import adminLogRoutes from './routes/adminLogRoutes.js';
import emailLogRoutes from './routes/emailLogRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import siteSurveyRoutes from './routes/siteSurveyRoutes.js';
import helpArticleRoutes from './routes/helpArticleRoutes.js';
import { seedDefaultLocations } from './controllers/locationController.js';
import { seedDefaultHelpArticles } from './controllers/helpArticleController.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import { initSocket } from './services/socketService.js';

dotenv.config();
connectDB().then(() => {
    seedDefaultLocations();
    seedDefaultHelpArticles();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// app.use(cors());
// for external access
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
const logFile = fs.createWriteStream('server_logs.txt', { flags: 'a' });



//request logging middleware
app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
        const logLine = `${new Date().toISOString()} - ${req.method} ${req.originalUrl} - STATUS: ${res.statusCode}\n`;
        console.log(logLine.trim());
        logFile.write(logLine);
        return originalSend.apply(res, arguments);
    };
    next();
});

// Serve static files from uploads directory (both /uploads and /api/uploads for Nginx/reverse proxy compatibility)
const uploadsDirectory = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}
app.use('/uploads', express.static(uploadsDirectory));
app.use('/api/uploads', express.static(uploadsDirectory));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/sectors', sectorRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/roles', rolePermissionRoutes); // Mounts on /api/roles to support /api/roles/:id/permissions
app.use('/api/hierarchy', hierarchyRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/live-dashboard', liveDashboardRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/responses', formResponseRoutes);
app.use('/api/woreda-profiles', woredaProfileRoutes);
app.use('/api/household-profiles', householdProfileRoutes);
app.use('/api/woreda-assessments', woredaAssessmentRoutes);
app.use('/api/profile-mappings', profileMappingRoutes);
app.use('/api/site-settings', portalContentRoutes);
app.use('/api/incident-reports', incidentReportRoutes);
app.use('/api/alert-subscriptions', alertSubscriptionRoutes);
app.use('/api/emergency-contacts', emergencyContactRoutes);
app.use('/api/inspection-requests', inspectionRequestRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/admin/news', newsRoutes);
app.use('/api/admin-logs', adminLogRoutes);
app.use('/api/email-logs', emailLogRoutes);
app.use('/api/site-survey', siteSurveyRoutes);
app.use('/api/help', helpArticleRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
initSocket(server);

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT} (Express + Socket.IO)`);
});






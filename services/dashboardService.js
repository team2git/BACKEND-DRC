import Department from '../models/Department.js';
import User from '../models/User.js';
import Role from '../models/Role.js';
import Organization from '../models/Organization.js';
import Sector from '../models/Sector.js';
import Permission from '../models/Permission.js';
import RolePermission from '../models/RolePermission.js';
import WoredaProfile from '../models/WoredaProfile.js';
import FormResponse from '../models/FormResponse.js';
import ProfileMapping from '../models/ProfileMapping.js';
import Template from '../models/Template.js';
import AuditLog from '../models/AuditLog.js';
import Team from '../models/Team.js';
import HouseholdProfile from '../models/HouseholdProfile.js';
import WoredaAssessment from '../models/WoredaAssessment.js';

/**
 * Get dashboard statistics filtered by user's permissions and hierarchy
 * @param {Object} user - The authenticated user object with populated fields
 * @returns {Object} Dashboard statistics scoped to user's access
 */
export const getDashboardStats = async (user) => {
    // Get user's permissions for dashboard cards
    const permissions = await getUserDashboardPermissions(user);

    // Build filter based on user's organizational hierarchy
    const filter = buildHierarchyFilter(user);

    // Initialize stats object with permissions
    const stats = {
        permissions, // Which cards the user can see
        userInfo: {
            accessLevel: user.accessLevel,
            organizationType: user.organizationType,
            organizationName: user.organization?.name || 'N/A',
            sectorName: user.sector?.name || 'N/A',
            departmentName: user.department?.name || 'N/A'
        }
    };

    // Build filters for WoredaProfile, FormResponse, ProfileMapping, Template, and AuditLog
    let woredaProfileFilter = {};
    let formResponseFilter = {};
    let profileMappingFilter = {};
    let templateFilter = {};
    let auditLogFilter = {};

    if (user.accessLevel !== 'super_admin') {
        const usersInHierarchy = await User.find(filter.user).select('_id');
        const userIds = usersInHierarchy.map(u => u._id);

        woredaProfileFilter = { 
            $or: [
                { createdBy: { $in: userIds } }, 
                { assessed_by: { $in: userIds } }
            ] 
        };
        formResponseFilter = { submittedBy: { $in: userIds } };
        profileMappingFilter = { createdBy: { $in: userIds } };
        templateFilter = { createdBy: { $in: userIds } };
        auditLogFilter = { userId: { $in: userIds } };
    }

    // Fetch new counts
    const totalHP = await HouseholdProfile.countDocuments(woredaProfileFilter);
    const totalWA = await WoredaAssessment.countDocuments(woredaProfileFilter);
    const totalWP = await WoredaProfile.countDocuments(woredaProfileFilter);

    stats.totalHouseholdProfiles = totalHP;
    stats.totalWoredaAssessments = totalWA;
    stats.totalWoredaProfiles = totalHP + totalWA + totalWP;
    stats.totalSurveys = await FormResponse.countDocuments(formResponseFilter);
    stats.totalMappings = await ProfileMapping.countDocuments(profileMappingFilter);
    stats.totalTemplates = await Template.countDocuments(templateFilter);

    // Profile status breakdown: Draft, Submitted, Reviewed (combining HouseholdProfile, WoredaAssessment, and WoredaProfile)
    const [hpStatusAgg, waStatusAgg, wpStatusAgg] = await Promise.all([
        HouseholdProfile.aggregate([
            { $match: woredaProfileFilter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        WoredaAssessment.aggregate([
            { $match: woredaProfileFilter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        WoredaProfile.aggregate([
            { $match: woredaProfileFilter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ])
    ]);
    stats.woredaByStatus = { Draft: 0, Submitted: 0, Reviewed: 0 };
    [...hpStatusAgg, ...waStatusAgg, ...wpStatusAgg].forEach(item => {
        const st = item._id;
        if (st && st in stats.woredaByStatus) {
            stats.woredaByStatus[st] += item.count;
        }
    });

    // Template status breakdown: Draft, Published, Archived
    const templateStatusAgg = await Template.aggregate([
        { $match: templateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);
    stats.templatesByStatus = { Draft: 0, Published: 0, Archived: 0 };
    templateStatusAgg.forEach(item => {
        if (item.status in stats.templatesByStatus) stats.templatesByStatus[item.status] = item.count;
    });

    // Mapping status breakdown: Draft, Published, Archived
    const mappingStatusAgg = await ProfileMapping.aggregate([
        { $match: profileMappingFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);
    stats.mappingsByStatus = { Draft: 0, Published: 0, Archived: 0 };
    mappingStatusAgg.forEach(item => {
        if (item.status in stats.mappingsByStatus) stats.mappingsByStatus[item.status] = item.count;
    });

    // Survey syncStatus breakdown: SYNCED, UNSYNCED, UPDATED
    const surveyStatusAgg = await FormResponse.aggregate([
        { $match: formResponseFilter },
        { $group: { _id: '$syncStatus', count: { $sum: 1 } } },
        { $project: { syncStatus: '$_id', count: 1, _id: 0 } }
    ]);
    stats.surveysBySyncStatus = { SYNCED: 0, UNSYNCED: 0, UPDATED: 0 };
    surveyStatusAgg.forEach(item => {
        if (item.syncStatus in stats.surveysBySyncStatus) stats.surveysBySyncStatus[item.syncStatus] = item.count;
    });

    // Also fetch user stats for the User Admin tab (always available to super_admin, else scoped)
    stats.totalUsers = await User.countDocuments(filter.user);
    stats.totalDepartments = await Department.countDocuments(filter.department);
    stats.totalRoles = await Role.countDocuments(filter.role);
    stats.totalOrganizations = await Organization.countDocuments(filter.organization);
    stats.totalSectors = await Sector.countDocuments(filter.sector);
    stats.usersByAccessLevel = await getUsersByAccessLevel(filter.user);
    stats.usersByOrganization = await getUsersByOrganization(filter.user);

    // Fetch recent database changes report (audit logs)
    stats.recentDatabaseChanges = await AuditLog.find(auditLogFilter)
        .populate('userId', 'fullname email')
        .sort({ timestamp: -1 })
        .limit(10)
        .lean();

    // Only fetch and include data for cards the user has permission to view
    if (permissions.canViewOrganizations) {
        stats.totalOrganizations = await Organization.countDocuments(filter.organization);
    }

    if (permissions.canViewSectors) {
        stats.totalSectors = await Sector.countDocuments(filter.sector);
    }

    if (permissions.canViewDepartments) {
        stats.totalDepartments = await Department.countDocuments(filter.department);
    }

    if (permissions.canViewUsers) {
        stats.totalUsers = await User.countDocuments(filter.user);
    }

    if (permissions.canViewRoles) {
        stats.totalRoles = await Role.countDocuments(filter.role);
    }

    // Add detailed breakdowns for higher access levels
    if (permissions.canViewAdvancedStats) {
        if (permissions.canViewUsers) {
            stats.usersByAccessLevel = await getUsersByAccessLevel(filter.user);
            stats.usersByOrganization = await getUsersByOrganization(filter.user);
        }
    }

    return stats;
};

/**
 * Get user's permissions for dashboard cards
 * @param {Object} user - The authenticated user
 * @returns {Object} Permission flags for each dashboard card
 */
const getUserDashboardPermissions = async (user) => {
    // Super admin has all permissions
    if (user.accessLevel === 'super_admin') {
        return {
            canViewOrganizations: true,
            canViewSectors: true,
            canViewDepartments: true,
            canViewUsers: true,
            canViewRoles: true,
            canViewAdvancedStats: true
        };
    }

    // Initialize all permissions as false
    const permissions = {
        canViewOrganizations: false, // Restricted to Super Admin
        canViewSectors: false,       // Restricted to Super Admin
        canViewDepartments: false,
        canViewUsers: false,
        canViewRoles: false,         // Restricted to Super Admin
        canViewAdvancedStats: false
    };

    // If user has no roles, return all false
    if (!user.roles || user.roles.length === 0) {
        return permissions;
    }

    const roleIds = user.roles.map(r => r._id);

    // Define permission mappings
    // Note: Organizations, Sectors, and Roles are now restricted to Super Admin only on dashboard
    const permissionMappings = [
        { resource: 'department', action: 'view', flag: 'canViewDepartments' },
        { resource: 'user', action: 'view', flag: 'canViewUsers' }
    ];

    // Check each permission
    for (const mapping of permissionMappings) {
        const permission = await Permission.findOne({
            resource: mapping.resource,
            action: mapping.action
        });

        if (permission) {
            const hasPermission = await RolePermission.findOne({
                roleId: { $in: roleIds },
                permissionId: permission._id
            });

            if (hasPermission) {
                permissions[mapping.flag] = true;
            }
        }
    }

    // Advanced stats available for managers and above
    if (['manager', 'branch_admin', 'deputy'].includes(user.accessLevel)) {
        permissions.canViewAdvancedStats = true;
    }

    return permissions;
};

/**
 * Build MongoDB filter based on user's hierarchical position
 * @param {Object} user - The authenticated user
 * @returns {Object} Filters for different collections
 */
const buildHierarchyFilter = (user) => {
    const filters = {
        department: {},
        user: {},
        role: {},
        organization: {},
        sector: {}
    };

    // Super admin sees everything
    if (user.accessLevel === 'super_admin') {
        return filters;
    }

    // Filter by organization
    if (user.organization) {
        filters.department.organization = user.organization._id;
        filters.user.organization = user.organization._id;
        filters.organization._id = user.organization._id;
        filters.sector.organization = user.organization._id;
    }

    // Filter by sector (for head office users with sector assignment)
    if (user.sector && user.organizationType === 'head_office') {
        filters.department.sector = user.sector._id;
        filters.user.sector = user.sector._id;
        filters.sector._id = user.sector._id;
    }

    // Filter by department (for users assigned to specific department)
    if (user.department) {
        // Department-level users only see their department
        if (['expert', 'team_leader'].includes(user.accessLevel)) {
            filters.department._id = user.department._id;
            filters.user.department = user.department._id;
        }
    }

    // Directorate can see their managed departments
    if (user.accessLevel === 'directorate' && user.managedDepartments?.length > 0) {
        filters.department._id = { $in: user.managedDepartments.map(d => d._id) };
        filters.user.department = { $in: user.managedDepartments.map(d => d._id) };
    }

    // Team leader can see their managed teams
    if (user.accessLevel === 'team_leader' && user.managedTeams?.length > 0) {
        filters.user.team = { $in: user.managedTeams.map(t => t._id) };
    }

    // Branch admin sees all in their branch
    if (user.accessLevel === 'branch_admin' && user.organizationType === 'branch') {
        // Already filtered by organization above
    }

    // Filter roles based on organization type
    if (user.organizationType) {
        filters.role.type = user.organizationType;
    }

    return filters;
};

/**
 * Get user count grouped by access level
 * @param {Object} baseFilter - Base filter to apply
 * @returns {Array} User counts by access level
 */
const getUsersByAccessLevel = async (baseFilter) => {
    return await User.aggregate([
        { $match: baseFilter },
        {
            $group: {
                _id: '$accessLevel',
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                accessLevel: '$_id',
                count: 1,
                _id: 0
            }
        }
    ]);
};

/**
 * Get user count grouped by organization
 * @param {Object} baseFilter - Base filter to apply
 * @returns {Array} User counts by organization
 */
const getUsersByOrganization = async (baseFilter) => {
    return await User.aggregate([
        { $match: baseFilter },
        {
            $group: {
                _id: '$organization',
                count: { $sum: 1 }
            }
        },
        {
            $lookup: {
                from: 'organizations',
                localField: '_id',
                foreignField: '_id',
                as: 'orgDetails'
            }
        },
        {
            $unwind: {
                path: '$orgDetails',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                organizationId: '$_id',
                organizationName: '$orgDetails.name',
                count: 1,
                _id: 0
            }
        }
    ]);
};

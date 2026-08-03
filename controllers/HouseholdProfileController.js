import HouseholdProfile from '../models/HouseholdProfile.js';
import WoredaProfile from '../models/WoredaProfile.js';

export const getHouseholdProfiles = async (req, res) => {
    try {
        const { subcity, woreda, kebele, block } = req.query;
        const query = {};
        if (subcity) query['location.subcity'] = new RegExp(`^${subcity}$`, 'i');
        if (woreda) query['location.woreda'] = new RegExp(`^${woreda}$`, 'i');
        if (kebele) query['location.kebele'] = new RegExp(`^${kebele}$`, 'i');
        if (block) query['location.block'] = new RegExp(`^${block}$`, 'i');

        const profiles = await HouseholdProfile.find(query).populate('createdBy', 'name email');
        res.json(profiles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getHouseholdProfileById = async (req, res) => {
    try {
        let profile = await HouseholdProfile.findById(req.params.id).populate('createdBy', 'name email');
        if (!profile) {
            profile = await WoredaProfile.findById(req.params.id).populate('createdBy', 'fullname');
        }
        if (!profile) return res.status(404).json({ message: 'Profile not found' });
        res.json(profile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createHouseholdProfile = async (req, res) => {
    try {
        const profileData = { ...req.body, createdBy: req.user?._id };
        const profile = new HouseholdProfile(profileData);
        const saved = await profile.save();
        res.status(201).json(saved);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const updateHouseholdProfile = async (req, res) => {
    try {
        let profile = await HouseholdProfile.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!profile) {
            const wp = await WoredaProfile.findById(req.params.id);
            if (wp) {
                wp.location = req.body.location || wp.location;
                wp.assessment_date = req.body.assessment_date || wp.assessment_date;
                wp.remarks = req.body.remarks || wp.remarks;
                wp.status = req.body.status || wp.status;
                
                wp.household_profile = {
                    ...(wp.household_profile || {}),
                    identity_location: req.body.identity_location || wp.household_profile?.identity_location,
                    demographics: req.body.demographics || wp.household_profile?.demographics,
                    livelihood_economy: req.body.livelihood_economy || wp.household_profile?.livelihood_economy,
                    housing_physical_conditions: req.body.housing_physical_conditions || wp.household_profile?.housing_physical_conditions,
                    preparedness: req.body.preparedness || wp.household_profile?.preparedness,
                    recovery_capacity: req.body.recovery_capacity || wp.household_profile?.recovery_capacity
                };
                
                profile = await wp.save();
            }
        }
        if (!profile) return res.status(404).json({ message: 'Profile not found' });
        res.json(profile);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteHouseholdProfile = async (req, res) => {
    try {
        let profile = await HouseholdProfile.findByIdAndDelete(req.params.id);
        if (!profile) {
            profile = await WoredaProfile.findByIdAndDelete(req.params.id);
        }
        if (!profile) return res.status(404).json({ message: 'Profile not found' });
        res.json({ message: 'Profile deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

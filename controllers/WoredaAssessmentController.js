import WoredaAssessment from '../models/WoredaAssessment.js';

export const getWoredaAssessments = async (req, res) => {
    try {
        const { subcity, woreda } = req.query;
        const query = { ...(req.dataScope || {}) };
        if (subcity) query['location.subcity'] = new RegExp(`^${subcity}$`, 'i');
        if (woreda) query['location.woreda'] = new RegExp(`^${woreda}$`, 'i');

        const assessments = await WoredaAssessment.find(query).populate('createdBy', 'name email');
        res.json(assessments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getWoredaAssessmentById = async (req, res) => {
    try {
        const assessment = await WoredaAssessment.findById(req.params.id).populate('createdBy', 'name email');
        if (!assessment) return res.status(404).json({ message: 'Assessment not found' });
        res.json(assessment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createWoredaAssessment = async (req, res) => {
    try {
        const assessmentData = { ...req.body, createdBy: req.user?._id };
        const assessment = new WoredaAssessment(assessmentData);
        const saved = await assessment.save();
        res.status(201).json(saved);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const updateWoredaAssessment = async (req, res) => {
    try {
        const assessment = await WoredaAssessment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!assessment) return res.status(404).json({ message: 'Assessment not found' });
        res.json(assessment);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteWoredaAssessment = async (req, res) => {
    try {
        const assessment = await WoredaAssessment.findByIdAndDelete(req.params.id);
        if (!assessment) return res.status(404).json({ message: 'Assessment not found' });
        res.json({ message: 'Assessment deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

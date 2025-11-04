const express = require('express');
const router = express.Router();
const { contractorProfileService } = require('../services/contractorProfile');

// Get all contractors
router.get('/', async (req, res) => {
  try {
    const contractors = await contractorProfileService.getAllContractors();
    res.json({
      success: true,
      contractors,
      count: contractors.length,
    });
  } catch (error) {
    console.error('Error fetching contractors:', error);
    res.status(500).json({ error: 'Failed to fetch contractors', details: error.message });
  }
});

// Get contractor by ID
router.get('/:contractorId', async (req, res) => {
  try {
    const { contractorId } = req.params;
    const contractor = await contractorProfileService.getContractorById(contractorId);
    
    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    res.json({
      success: true,
      contractor,
    });
  } catch (error) {
    console.error('Error fetching contractor:', error);
    res.status(500).json({ error: 'Failed to fetch contractor', details: error.message });
  }
});

// Register push notification token
router.post('/:contractorId/push-token', async (req, res) => {
  try {
    const { contractorId } = req.params;
    const { expoPushToken } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({ error: 'Push token is required' });
    }

    const contractor = await contractorProfileService.updatePushToken(contractorId, expoPushToken);

    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    console.log(`✅ Registered push token for contractor ${contractorId}`);

    res.json({
      success: true,
      message: 'Push token registered successfully',
      contractor: {
        id: contractor.id,
        name: contractor.name,
        hasPushToken: !!contractor.expoPushToken,
      },
    });

  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({ error: 'Failed to register push token', details: error.message });
  }
});

// Create or update contractor profile
router.post('/', async (req, res) => {
  try {
    const contractorData = req.body;

    if (!contractorData.id || !contractorData.name || !contractorData.trades) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['id', 'name', 'trades'],
      });
    }

    const contractor = await contractorProfileService.upsertContractor(contractorData);

    res.status(201).json({
      success: true,
      contractor,
      message: 'Contractor profile saved successfully',
    });

  } catch (error) {
    console.error('Error saving contractor profile:', error);
    res.status(500).json({ error: 'Failed to save contractor profile', details: error.message });
  }
});

module.exports = router;

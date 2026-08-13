import { BusinessType } from '../types/types';

export const DomainLogicManager = {
  getRules(businessType: BusinessType) {
    switch (businessType) {
      case BusinessType.GROCERY:
        return {
          requiresBatchTracking: true,
          requiresExpiryDate: true,
          accountingFlow: 'RETAIL_PERPETUAL',
          customModules: ['WASTE_MANAGEMENT']
        };
      case BusinessType.HOUSEHOLD_APPLIANCES:
      case BusinessType.ELECTRICAL:
        return {
          requiresSerialTracking: true,
          accountingFlow: 'RETAIL_PERPETUAL',
          customModules: ['WARRANTY_MANAGEMENT']
        };
      case BusinessType.PHARMACY:
        return {
          requiresBatchTracking: true,
          requiresExpiryDate: true,
          accountingFlow: 'RETAIL_PERPETUAL',
          customModules: ['PHARMACY_PRESCRIPTIONS']
        };
      default:
        return {
          requiresBatchTracking: false,
          requiresExpiryDate: false,
          accountingFlow: 'RETAIL_PERPETUAL',
          customModules: []
        };
    }
  }
};

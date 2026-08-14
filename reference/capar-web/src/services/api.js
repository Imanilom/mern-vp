// CAPAR Web Console API Client & Mock Domain Engine
import {
  INITIAL_ROLE,
  COHORTS,
  PARTICIPANTS,
  EPISODES,
  PERSONAL_EXPERIENCE_MODELS,
  MODEL_RULES_CONFIG,
  EXPORT_JOBS,
  AUDIT_TRAIL
} from './mockData';

export const api = {
  async getMe() {
    return INITIAL_ROLE;
  },

  async getCohorts() {
    return COHORTS;
  },

  async getParticipants(cohortId = 'pilot-01') {
    return PARTICIPANTS;
  },

  async getEpisodes() {
    return EPISODES;
  },

  async getPersonalExperience() {
    return PERSONAL_EXPERIENCE_MODELS;
  },

  async getModelRules() {
    return MODEL_RULES_CONFIG;
  },

  async getExportJobs() {
    return EXPORT_JOBS;
  },

  async getAuditTrail() {
    return AUDIT_TRAIL;
  }
};

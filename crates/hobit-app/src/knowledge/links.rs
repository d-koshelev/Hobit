use crate::ArtifactRef;

use super::{EvidenceRef, KnowledgeItemRef};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EvidenceArtifactLink {
    pub artifact: ArtifactRef,
    pub evidence_eligible: bool,
}

impl EvidenceArtifactLink {
    pub fn new(artifact: ArtifactRef) -> Self {
        Self {
            artifact,
            evidence_eligible: false,
        }
    }

    pub fn explicitly_evidence_eligible(mut self) -> Self {
        self.evidence_eligible = true;
        self
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KnowledgeEvidenceLink {
    pub knowledge_item: KnowledgeItemRef,
    pub evidence: EvidenceRef,
}

impl KnowledgeEvidenceLink {
    pub fn new(knowledge_item: KnowledgeItemRef, evidence: EvidenceRef) -> Self {
        Self {
            knowledge_item,
            evidence,
        }
    }
}

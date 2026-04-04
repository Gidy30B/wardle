import { Module } from '@nestjs/common';
import { OntologyService } from './ontology.service.js';
import { SynonymService } from './synonym.service.js';

@Module({
  providers: [SynonymService, OntologyService],
  exports: [SynonymService, OntologyService],
})
export class KnowledgeModule {}

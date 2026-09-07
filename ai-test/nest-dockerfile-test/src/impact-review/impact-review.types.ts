export type ReviewStatus =
  | 'queued'
  | 'analyzing'
  | 'waiting_for_deployment'
  | 'running'
  | 'passed'
  | 'failed';

export type TestType = 'unit' | 'integration' | 'e2e' | 'security' | 'build';

export interface CreateReviewDto {
  repositoryPath: string;
  commit: string;
  baseCommit?: string;
  environment?: string;
  testTypes?: TestType[];
  deploy?: boolean;
}

export interface ChangedFile {
  status: string;
  path: string;
  additions: number;
  deletions: number;
}

export interface ImpactArea {
  name: string;
  reason: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  files: string[];
}

export interface TestPlanItem {
  type: TestType;
  reason: string;
  command: string;
  selected: boolean;
}

export interface ReviewRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ReviewStatus;
  request: CreateReviewDto;
  commitMessage?: string;
  changedFiles: ChangedFile[];
  impactAreas: ImpactArea[];
  testPlan: TestPlanItem[];
  deployment: {
    requested: boolean;
    status: 'not_requested' | 'pending_adapter' | 'ready';
    environment: string;
  };
  results: Array<{
    type: TestType;
    status: 'passed' | 'failed' | 'skipped';
    durationMs: number;
    output?: string;
    error?: string;
  }>;
  error?: string;
}

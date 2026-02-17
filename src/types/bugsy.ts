// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
// ⚠️ DO NOT remove, rename, or delete this file or any code in it without explicit permission from the project owner.
// ⚠️ When editing: FIX ONLY what is requested. Do NOT remove existing code, comments, console.logs, or imports.
// ============================================================================
// BUGSY AI SYSTEM - TypeScript Types
// Version: 1.0.0
// Description: Complete type definitions matching database schema
// ============================================================================

// ============================================================================
// SECTION 1: CORE BUG REPORT TYPES
// ============================================================================

export type BugReportStatus = 'new' | 'investigating' | 'fixed' | 'wont_fix' | 'duplicate';
export type BugPriority = 'critical' | 'high' | 'medium' | 'low';
export type UserRole = 'admin' | 'provider' | 'assistant';
export type LiveSessionStatus = 'requested' | 'active' | 'completed';

export interface BugReportAttachment {
  id: string;
  type: 'video' | 'screenshot' | 'markers' | 'file';
  url: string;
  name: string;
  size?: number;
  mime_type?: string;
  duration_seconds?: number;
  transcript?: string;
  annotations?: Annotation[];
  markers?: ScreenMarker[];
  created_at: string;
}

export interface Annotation {
  type: 'arrow' | 'circle' | 'rectangle' | 'text' | 'freehand';
  color: string;
  from?: [number, number];
  to?: [number, number];
  center?: [number, number];
  radius?: number;
  position?: [number, number];
  width?: number;
  height?: number;
  content?: string;
  fontSize?: number;
  points?: Array<[number, number]>;
}

export interface ScreenMarker {
  number: number;
  timestamp_ms: number;
  x_percent: number;
  y_percent: number;
  element_selector?: string;
  element_tag?: string;
  element_text?: string;
  element_id?: string;
  component_identified?: string;
  handler_identified?: string;
  description?: string;
  speech_at_moment?: string;
  action_type?: string;
}

export interface InteractionEvent {
  timestamp_ms: number;
  action_type: 'click' | 'scroll' | 'type' | 'hover' | 'focus' | 'blur';
  position?: {
    x: number;
    y: number;
    x_percent: number;
    y_percent: number;
  };
  element?: {
    selector: string;
    tag: string;
    text?: string;
    id?: string;
    classes?: string[];
  };
  element_identified?: {
    component: string;
    file: string;
    handler?: string;
    api_endpoint?: string;
  };
  input_value?: string;
  result?: {
    triggered_api?: boolean;
    api_endpoint?: string;
    success?: boolean;
    error?: string;
  };
}

export interface TranscriptSegment {
  time: number;
  text: string;
  confidence?: number;
  keywords?: string[];
}

export interface PrioritySignal {
  signal: string;
  weight: number;
  matched: boolean;
  details?: string;
}

export interface ConfidenceBreakdown {
  problem_clarity: number;
  location_clarity: number;
  steps_clarity: number;
  expected_clarity: number;
  context_clarity: number;
  pattern_bonus: number;
  total: number;
}

export interface StepToReproduce {
  step: number;
  action: string;
  element?: string;
  expected_result?: string;
}

export interface BugsyInterviewData {
  phase: InterviewPhase;
  context: InterviewContext;
  recording: RecordingData;
  transcript: TranscriptData;
  interactions: InteractionEvent[];
  markers: ScreenMarker[];
  analysis: AnalysisResult;
  gaps: GapTracking;
  answers: DoctorAnswers;
  confidence: ConfidenceData;
}

export type InterviewPhase = 
  | 'idle'
  | 'recording'
  | 'processing'
  | 'reflection'
  | 'clarifying'
  | 'verification'
  | 'submitting'
  | 'success'
  | 'error';

export interface InterviewContext {
  page_url: string;
  page_name: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  session_id: string;
  browser: string;
  screen_size: { width: number; height: number };
  timestamp: string;
  page_elements?: UIElement[];
  recent_actions?: InteractionEvent[];
  known_issues?: SimilarBug[];
}

export interface RecordingData {
  video_url: string | null;
  duration_seconds: number;
  file_size_bytes: number;
}

export interface TranscriptData {
  full_text: string;
  segments: TranscriptSegment[];
  keywords_found: string[];
}

export interface AnalysisResult {
  problem_identified: string;
  elements_involved: string[];
  components_identified: string[];
  files_identified: string[];
  api_endpoints_identified: string[];
  pattern_matches: PatternMatch[];
  similar_bugs: SimilarBug[];
}

export interface GapTracking {
  expected_behavior: 'known' | 'unknown' | 'partial';
  error_message: 'known' | 'unknown' | 'none';
  frequency: 'known' | 'unknown';
  worked_before: 'known' | 'unknown';
}

export interface DoctorAnswers {
  reflection_confirmed: boolean;
  corrections: string[];
  expected_behavior: string[];
  error_message: string | null;
  frequency: 'always' | 'sometimes' | 'first_time' | null;
  worked_before: 'yes' | 'no' | 'unknown' | null;
  additional_notes: string;
}

export interface ConfidenceData {
  score: number;
  breakdown: ConfidenceBreakdown;
  minimum_required: number;
  ready_to_submit: boolean;
}

export interface BugReport {
  id: string;
  doctor_id: string;
  
  // Reporter info
  reporter_name?: string;
  reporter_role?: UserRole;
  
  // Content
  title?: string;
  description: string;
  what_happened?: string;
  expected_behavior?: string;
  steps_to_reproduce?: StepToReproduce[];
  
  // Location
  page_url: string;
  page_name?: string;
  github_file_path?: string;
  github_file_url?: string;
  
  // Context
  browser_info?: string;
  screen_size?: { width: number; height: number };
  session_id?: string;
  
  // Recording
  recording_url?: string;
  recording_duration_seconds?: number;
  transcript?: string;
  transcript_segments?: TranscriptSegment[];
  
  // Markers & Interactions
  markers?: ScreenMarker[];
  interactions?: InteractionEvent[];
  
  // Status & Priority
  status: BugReportStatus;
  priority?: BugPriority;
  priority_inferred?: boolean;
  priority_signals?: PrioritySignal[];
  admin_read: boolean;
  
  // Admin response
  admin_notes?: string;
  admin_response_video_url?: string;
  admin_response_video_name?: string;
  assigned_to?: string;
  
  // AI processing
  ai_summary?: string;
  confidence_score?: number;
  confidence_breakdown?: ConfidenceBreakdown;
  
  // Bugsy interview data
  bugsy_interview_data?: BugsyInterviewData;
  
  // Attachments
  attachments: BugReportAttachment[];
  
  // Legacy fields
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  
  // Live session
  live_session_status?: LiveSessionStatus;
  live_session_room_url?: string;
  live_session_requested_by?: 'admin' | 'doctor';
  live_session_requested_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  viewed_at?: string;
  resolved_at?: string;
}

// ============================================================================
// SECTION 2: BUG TICKET TYPES (Technical Analysis)
// ============================================================================

export interface PatternMatch {
  pattern_id: string;
  pattern_name: string;
  similarity: number;
  confidence_boost: number;
  matched_keywords: string[];
}

export interface SimilarBug {
  bug_id: string;
  title: string;
  similarity: number;
  root_cause?: string;
  fix_applied?: string;
  was_successful?: boolean;
}

export interface SuggestedFix {
  description: string;
  code?: string;
  diff?: string;
  files: string[];
  steps?: string[];
}

export interface VerificationStep {
  step: number;
  action: string;
  expected_result: string;
}

export interface BugTicket {
  id: string;
  bug_report_id: string;
  
  // Doctor's words
  user_description?: string;
  
  // Technical analysis
  bugsy_interpretation?: string;
  technical_analysis?: string;
  
  // Location
  page_url?: string;
  components_identified: string[];
  files_identified: string[];
  handlers_identified: string[];
  api_endpoints_identified: string[];
  
  // Root cause
  likely_root_cause?: string;
  root_cause_file?: string;
  root_cause_line?: number;
  root_cause_confidence?: number;
  
  // Suggested fix
  suggested_fix_description?: string;
  suggested_fix_code?: string;
  suggested_fix_diff?: string;
  suggested_fix_files: string[];
  
  // Pattern matching
  pattern_matches: PatternMatch[];
  similar_past_bugs: SimilarBug[];
  
  // Developer ticket
  full_ticket_markdown?: string;
  verification_steps: VerificationStep[];
  
  // Fix tracking
  fix_applied: boolean;
  fix_applied_at?: string;
  fix_applied_by?: string;
  fix_pr_url?: string;
  fix_pr_number?: number;
  fix_commit_sha?: string;
  fix_verified: boolean;
  fix_verified_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface BugReportMarker {
  id: string;
  bug_report_id: string;
  marker_number: number;
  timestamp_ms?: number;
  x_percent: number;
  y_percent: number;
  element_selector?: string;
  element_tag?: string;
  element_text?: string;
  element_id?: string;
  element_classes?: string[];
  component_identified?: string;
  handler_identified?: string;
  api_endpoint_identified?: string;
  description?: string;
  speech_at_moment?: string;
  action_type?: string;
  created_at: string;
}

// ============================================================================
// SECTION 3: BUGSY KNOWLEDGE BASE TYPES
// ============================================================================

export type FileType = 'component' | 'page' | 'api' | 'lib' | 'hook' | 'type' | 'util' | 'config' | 'style';

export interface ImportInfo {
  from: string;
  items: string[];
  default?: string;
}

export interface BugsyFile {
  id: string;
  file_path: string;
  file_type?: FileType;
  file_name?: string;
  description?: string;
  exports: string[];
  default_export?: string;
  imports: ImportInfo[];
  imported_by: string[];
  content_snapshot?: string;
  content_hash?: string;
  lines_of_code?: number;
  last_modified?: string;
  last_scanned: string;
  created_at: string;
  updated_at: string;
}

export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  default_value?: string;
  description?: string;
}

export interface StateVariable {
  name: string;
  type: string;
  initial_value?: string;
  setter_name?: string;
}

export interface HandlerDefinition {
  name: string;
  triggers: string[];
  calls_api?: string;
  api_method?: string;
  parameters?: string[];
  async: boolean;
}

export interface EffectDefinition {
  dependencies: string[];
  fetches?: string;
  cleanup?: boolean;
}

export interface BugsyComponent {
  id: string;
  file_id?: string;
  file_path: string;
  component_name: string;
  props: PropDefinition[];
  state_variables: StateVariable[];
  handlers: HandlerDefinition[];
  effects: EffectDefinition[];
  renders: string[];
  contexts_used: string[];
  last_scanned: string;
  created_at: string;
  updated_at: string;
}

export type ElementType = 'button' | 'input' | 'link' | 'dropdown' | 'select' | 'checkbox' | 'radio' | 'textarea' | 'form' | 'modal' | 'other';

export interface UIElement {
  id: string;
  page_url: string;
  page_name?: string;
  element_selector: string;
  element_tag?: string;
  element_type?: ElementType;
  element_text?: string;
  element_id?: string;
  element_testid?: string;
  element_classes?: string[];
  position_x_percent?: number;
  position_y_percent?: number;
  width_percent?: number;
  height_percent?: number;
  component_name?: string;
  component_file?: string;
  handler_name?: string;
  handler_code_snippet?: string;
  api_endpoint?: string;
  api_method?: string;
  parent_element?: string;
  parent_component?: string;
  visible_when?: string;
  last_captured: string;
  capture_count: number;
  created_at: string;
  updated_at: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface ErrorResponse {
  status: number;
  message: string;
  code?: string;
}

export interface BugsyApiRoute {
  id: string;
  file_path: string;
  method: HttpMethod;
  endpoint_pattern: string;
  request_body_schema?: Record<string, unknown>;
  request_params_schema?: Record<string, unknown>;
  query_params_schema?: Record<string, unknown>;
  response_schema?: Record<string, unknown>;
  error_responses: ErrorResponse[];
  database_tables: string[];
  database_operations: string[];
  auth_required: boolean;
  required_role?: UserRole;
  description?: string;
  example_request?: Record<string, unknown>;
  example_response?: Record<string, unknown>;
  code_snapshot?: string;
  last_scanned: string;
  created_at: string;
  updated_at: string;
}

export type FlowType = 'create' | 'read' | 'update' | 'delete' | 'navigate' | 'auth' | 'upload' | 'download';

export interface FlowStep {
  step: number;
  type: 'handler' | 'api_call' | 'database' | 'state_update' | 'navigation' | 'validation';
  file?: string;
  function_name?: string;
  description: string;
  can_fail: boolean;
  failure_reason?: string;
}

export interface FailurePoint {
  point: string;
  possible_causes: string[];
  detection_method?: string;
}

export interface BugsyDataFlow {
  id: string;
  flow_name: string;
  flow_type?: FlowType;
  trigger_page?: string;
  trigger_element?: string;
  trigger_element_selector?: string;
  trigger_action?: string;
  steps: FlowStep[];
  database_tables: string[];
  database_operations: string[];
  success_outcome?: string;
  success_indicators: string[];
  failure_points: FailurePoint[];
  components_involved: string[];
  files_involved: string[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SECTION 4: LEARNING SYSTEM TYPES
// ============================================================================

export interface AffectedLine {
  file: string;
  line_start: number;
  line_end: number;
}

export interface BugsyPastBug {
  id: string;
  bug_report_id?: string;
  bug_ticket_id?: string;
  symptom_keywords: string[];
  symptom_text?: string;
  symptom_hash?: string;
  page_url?: string;
  page_name?: string;
  component_name?: string;
  root_cause: string;
  root_cause_category?: string;
  root_cause_subcategory?: string;
  affected_files: string[];
  affected_components: string[];
  affected_lines: AffectedLine[];
  fix_description: string;
  fix_diff?: string;
  fix_files: string[];
  fix_code_before?: string;
  fix_code_after?: string;
  pattern_tags: string[];
  times_pattern_matched: number;
  times_fix_applied: number;
  times_fix_successful: number;
  fix_success_rate?: number;
  reporter_id?: string;
  fixed_by?: string;
  verified_by?: string;
  created_at: string;
  updated_at: string;
}

export interface FixStep {
  step: number;
  action: string;
  file?: string;
  code?: string;
}

export interface BugsyFixPattern {
  id: string;
  pattern_name: string;
  pattern_category?: string;
  pattern_subcategory?: string;
  symptom_keywords: string[];
  symptom_regex?: string;
  code_pattern_regex?: string;
  file_pattern?: string;
  requires_page_match: boolean;
  requires_component_match: boolean;
  applicable_file_types: FileType[];
  fix_description: string;
  fix_template?: string;
  fix_example_before?: string;
  fix_example_after?: string;
  fix_steps: FixStep[];
  confidence_boost: number;
  times_matched: number;
  times_applied: number;
  times_successful: number;
  success_rate?: number;
  average_fix_time_minutes?: number;
  is_active: boolean;
  is_verified: boolean;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BugsyUserVocabulary {
  id: string;
  user_id: string;
  user_term: string;
  system_term: string;
  term_category?: string;
  context?: string;
  times_used: number;
  first_used: string;
  last_used: string;
  created_at: string;
}

export interface BugsyDefaultVocabulary {
  id: string;
  user_term: string;
  system_term: string;
  term_category?: string;
  description?: string;
  priority: number;
  is_active: boolean;
  created_at: string;
}

// ============================================================================
// SECTION 5: USER ROLES AND PERMISSIONS TYPES
// ============================================================================

export type PermissionRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AssistantStatus = 'active' | 'suspended' | 'revoked';

export interface UserRoleRecord {
  id: string;
  user_id: string;
  email?: string;
  role: UserRole;
  primary_provider_id?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface ProviderAssistant {
  id: string;
  provider_id: string;
  assistant_id: string;
  permissions: string[];
  status: AssistantStatus;
  granted_at: string;
  granted_by?: string;
  suspended_at?: string;
  suspended_reason?: string;
  revoked_at?: string;
  revoked_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface PermissionDefinition {
  id: string;
  permission_key: string;
  category: string;
  display_name: string;
  description?: string;
  default_for_provider: boolean;
  default_for_assistant: boolean;
  risk_level: PermissionRiskLevel;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// ============================================================================
// SECTION 6: AUDIT LOG TYPES
// ============================================================================

export type AuditActionType = 
  | 'login'
  | 'logout'
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'permission_change'
  | 'status_change'
  | 'bug_report_submit'
  | 'bug_report_respond'
  | 'fix_applied';

export type AuditResourceType = 
  | 'bug_report'
  | 'bug_ticket'
  | 'patient'
  | 'appointment'
  | 'medical_record'
  | 'prescription'
  | 'user'
  | 'permission'
  | 'system';

export interface AuditLog {
  id: string;
  logged_at: string;
  user_id?: string;
  user_email?: string;
  user_role?: UserRole;
  user_name?: string;
  action_type: AuditActionType;
  resource_type: AuditResourceType;
  resource_id?: string;
  resource_name?: string;
  details?: Record<string, unknown>;
  previous_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  page_url?: string;
  session_id?: string;
  patient_id?: string;
  created_at: string;
}

// ============================================================================
// SECTION 7: NOTIFICATION TYPES
// ============================================================================

export type NotificationType = 
  | 'bug_report_submitted'
  | 'bug_report_response'
  | 'bug_report_status_change'
  | 'bug_report_fixed'
  | 'live_session_request'
  | 'system_alert';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface BugsyNotification {
  id: string;
  user_id: string;
  user_role?: UserRole;
  notification_type: NotificationType;
  title: string;
  message: string;
  reference_type?: string;
  reference_id?: string;
  is_read: boolean;
  read_at?: string;
  show_badge: boolean;
  show_sound: boolean;
  show_banner: boolean;
  priority: NotificationPriority;
  expires_at?: string;
  created_at: string;
}

// ============================================================================
// SECTION 8: API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateBugReportRequest {
  description: string;
  page_url: string;
  page_name?: string;
  what_happened?: string;
  expected_behavior?: string;
  steps_to_reproduce?: StepToReproduce[];
  recording_url?: string;
  recording_duration_seconds?: number;
  transcript?: string;
  transcript_segments?: TranscriptSegment[];
  markers?: ScreenMarker[];
  interactions?: InteractionEvent[];
  attachments?: BugReportAttachment[];
  confidence_score?: number;
  confidence_breakdown?: ConfidenceBreakdown;
  bugsy_interview_data?: BugsyInterviewData;
  browser_info?: string;
  screen_size?: { width: number; height: number };
}

export interface UpdateBugReportRequest {
  status?: BugReportStatus;
  priority?: BugPriority;
  admin_notes?: string;
  admin_response_video_url?: string;
  assigned_to?: string;
}

export interface BugReportResponse {
  success: boolean;
  data?: BugReport;
  error?: string;
}

export interface BugReportListResponse {
  success: boolean;
  data?: BugReport[];
  total?: number;
  page?: number;
  per_page?: number;
  error?: string;
}

export interface AnalyzeBugRequest {
  transcript: string;
  interactions: InteractionEvent[];
  markers: ScreenMarker[];
  page_url: string;
  user_id: string;
}

export interface AnalyzeBugResponse {
  success: boolean;
  data?: {
    analysis: AnalysisResult;
    confidence: ConfidenceData;
    ticket?: Partial<BugTicket>;
  };
  error?: string;
}

// ============================================================================
// SECTION 9: COMPONENT PROP TYPES
// ============================================================================

export interface BugsyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess?: (reportId: string) => void;
}

export interface BugsyWidgetProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  notificationCount?: number;
}

export interface BugsyRecorderProps {
  onRecordingComplete: (data: RecordingData, transcript: TranscriptData, interactions: InteractionEvent[], markers: ScreenMarker[]) => void;
  onError: (error: string) => void;
}

export interface BugsyReflectionProps {
  transcript: string;
  analysis: AnalysisResult;
  markers: ScreenMarker[];
  onConfirm: () => void;
  onCorrect: (corrections: string[]) => void;
  onReRecord: () => void;
}

export interface BugsyClarifyProps {
  gaps: GapTracking;
  analysis: AnalysisResult;
  onAnswers: (answers: Partial<DoctorAnswers>) => void;
}

export interface BugsyVerificationProps {
  report: Partial<BugReport>;
  confidence: ConfidenceData;
  onEdit: () => void;
  onSubmit: () => void;
}

// ============================================================================
// SECTION 10: UTILITY TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type WithTimestamps<T> = T & {
  created_at: string;
  updated_at: string;
};

export type WithId<T> = T & {
  id: string;
};

export interface PaginationParams {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface FilterParams {
  status?: BugReportStatus[];
  priority?: BugPriority[];
  reporter_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    total?: number;
    page?: number;
    per_page?: number;
    total_pages?: number;
  };
}

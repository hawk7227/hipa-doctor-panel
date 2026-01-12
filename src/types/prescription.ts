export interface Patient {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'M' | 'F' | 'Other';
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email?: string;
}

export interface Medication {
  id?: string;
  drugName: string;
  strength: string;
  dosageForm: string;
  quantity: number;
  directions: string;
  refills: number;
  daysSupply: number;
}

export interface Prescription {
  id?: string;
  patient: Patient;
  medications: Medication[];
  prescriberId: string;
  prescriberName: string;
  prescriberNPI: string;
  prescriberDEA: string;
  pharmacyName?: string;
  pharmacyAddress?: string;
  pharmacyPhone?: string;
  notes?: string;
  createdAt?: string;
  status?: 'draft' | 'sent' | 'delivered' | 'failed';
}

export interface DirectMessagePayload {
  to: string;
  from: string;
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

export interface EMRDirectResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: any;
}









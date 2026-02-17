// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import { DirectMessagePayload, EMRDirectResponse, Prescription } from '@/types/prescription';
import fs from 'fs';
import path from 'path';

// Import PhiMailConnector SDK - using require because it's a CommonJS module without type definitions
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PhiMailConnector = require('../../packages/phimail-connector/index.js');

// Initialize server certificate once (if available)
let certificateLoaded = false;
function loadServerCertificate() {
  if (certificateLoaded) return;
  
  const certPath = path.join(process.cwd(), 'EMRDirectTestCA.pem');
  if (fs.existsSync(certPath)) {
    try {
      PhiMailConnector.setServerCertificate(certPath);
      certificateLoaded = true;
      console.log('✅ PhiMail Server certificate loaded:', certPath);
    } catch (err) {
      console.error('⚠️ Failed to load server certificate:', err);
    }
  } else {
    console.warn('⚠️ Server certificate not found at:', certPath);
  }
}

// FHIR R4 Response Types
interface FHIRBundle {
  resourceType: string;
  type: string;
  total?: number;
  entry?: FHIREntry[];
  [key: string]: unknown;
}

interface FHIREntry {
  resource: {
    resourceType: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface QueryResponse {
  success: boolean;
  data?: FHIREntry[];
  total?: number;
  bundle?: FHIRBundle;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * EMRDirect API Client for PHIMAIL Direct Messaging
 */
export class EMRDirectClient {
  private server: string;
  private port: string;
  private username: string;
  private password: string;

  constructor() {
    this.server = process.env.PHIMAIL_SERVER || '';
    this.port = process.env.PHIMAIL_PORT || '443'; // Default to HTTPS port
    this.username = process.env.PHIMAIL_USERNAME || '';
    this.password = process.env.PHIMAIL_PASSWORD || '';
  }

  /**
   * Validate EMRDirect configuration
   */
  private validateConfig(): { valid: boolean; error?: string } {
    if (!this.server) {
      return {
        valid: false,
        error: 'PHIMAIL_SERVER environment variable is not set'
      };
    }
    
    const portNum = parseInt(this.port);
    if (isNaN(portNum) || portNum < 0 || portNum >= 65536) {
      return {
        valid: false,
        error: `Invalid PHIMAIL_PORT: "${this.port}". Port must be a number between 0 and 65535.`
      };
    }
    
    if (!this.username) {
      return {
        valid: false,
        error: 'PHIMAIL_USERNAME environment variable is not set'
      };
    }
    
    if (!this.password) {
      return {
        valid: false,
        error: 'PHIMAIL_PASSWORD environment variable is not set'
      };
    }
    
    return { valid: true };
  }

  /**
   * Validate Direct address format
   */
  private validateDirectAddress(address: string): { valid: boolean; error?: string } {
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(address)) {
      return {
        valid: false,
        error: 'Invalid Direct address format. Must be in format: user@domain.com'
      };
    }
    
    // Check for common invalid domains
    const commonInvalidDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    const domain = address.split('@')[1].toLowerCase();
    if (commonInvalidDomains.includes(domain)) {
      return {
        valid: false,
        error: `"${domain}" is not a Direct messaging domain. Direct addresses use special healthcare domains (e.g., *.direct.com, *.directproject.net)`
      };
    }
    
    return { valid: true };
  }

  /**
   * Send prescription via Direct Messaging
   */
  async sendPrescription(
    prescription: Prescription,
    recipientAddress: string
  ): Promise<EMRDirectResponse> {
    try {
      // Validate Direct address format before attempting to send
      const validation = this.validateDirectAddress(recipientAddress);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      const message = this.formatPrescriptionMessage(prescription);
      
      const payload: DirectMessagePayload = {
        from: this.username,
        to: recipientAddress,
        subject: `eRx: ${prescription.patient.firstName} ${prescription.patient.lastName}`,
        body: message,
      };

      // In a real implementation, you would use nodemailer or a Direct messaging library
      // For now, we'll create the structure
      const response = await this.sendDirectMessage(payload);
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Format prescription data into a readable message
   */
  private formatPrescriptionMessage(prescription: Prescription): string {
    const { patient, medications, prescriberName, prescriberNPI, prescriberDEA } = prescription;

    let message = `ELECTRONIC PRESCRIPTION\n\n`;
    message += `Date: ${new Date().toLocaleString()}\n\n`;
    
    message += `PRESCRIBER INFORMATION:\n`;
    message += `Name: ${prescriberName}\n`;
    message += `NPI: ${prescriberNPI}\n`;
    message += `DEA: ${prescriberDEA}\n\n`;

    message += `PATIENT INFORMATION:\n`;
    message += `Name: ${patient.firstName} ${patient.lastName}\n`;
    message += `Date of Birth: ${patient.dateOfBirth}\n`;
    message += `Gender: ${patient.gender}\n`;
    message += `Address: ${patient.address}, ${patient.city}, ${patient.state} ${patient.zipCode}\n`;
    message += `Phone: ${patient.phone}\n`;
    if (patient.email) message += `Email: ${patient.email}\n`;
    message += `\n`;

    message += `MEDICATIONS:\n`;
    medications.forEach((med, index) => {
      message += `\n${index + 1}. ${med.drugName} ${med.strength}\n`;
      message += `   Form: ${med.dosageForm}\n`;
      message += `   Quantity: ${med.quantity}\n`;
      message += `   Directions: ${med.directions}\n`;
      message += `   Refills: ${med.refills}\n`;
      message += `   Days Supply: ${med.daysSupply}\n`;
    });

    if (prescription.pharmacyName) {
      message += `\nPHARMACY:\n`;
      message += `${prescription.pharmacyName}\n`;
      if (prescription.pharmacyAddress) message += `${prescription.pharmacyAddress}\n`;
      if (prescription.pharmacyPhone) message += `Phone: ${prescription.pharmacyPhone}\n`;
    }

    if (prescription.notes) {
      message += `\nADDITIONAL NOTES:\n${prescription.notes}\n`;
    }

    return message;
  }

  /**
   * Send Direct Message via PHIMAIL Direct Messaging using PhiMailConnector SDK
   */
  private async sendDirectMessage(payload: DirectMessagePayload): Promise<EMRDirectResponse> {
    // Validate configuration first
    const configValidation = this.validateConfig();
    if (!configValidation.valid) {
      console.error('❌ EMRDirect Configuration Error:', configValidation.error);
      return {
        success: false,
        error: configValidation.error || 'EMRDirect configuration is invalid',
      };
    }

    const portNum = parseInt(this.port);
    console.log('📤 EMRDirect PHIMAIL - Sending Prescription:', {
      server: this.server,
      port: portNum,
      from: this.username,
      to: payload.to,
      subject: payload.subject,
    });

    // Load server certificate before connecting
    loadServerCertificate();

    return new Promise((resolve) => {
      let pc: typeof PhiMailConnector | null = null;

      // Connect to PhiMail server
      pc = new PhiMailConnector(this.server, portNum, (err: Error | null) => {
        if (err) {
          console.error('❌ EMRDirect Connection Error:', err.message);
          return resolve({
            success: false,
            error: `Connection failed: ${err.message}`,
          });
        }

        // Authenticate user
        pc.authenticateUser(this.username, this.password, (authErr: Error | null) => {
          if (authErr) {
            console.error('❌ EMRDirect Authentication Error:', authErr.message);
            pc.close(() => {});
            return resolve({
              success: false,
              error: `Authentication failed: ${authErr.message}`,
            });
          }

          console.log('✅ Authenticated successfully');

          // Add recipient
          pc.addRecipient(payload.to, (recErr: Error | null, recipientData: string) => {
            if (recErr) {
              console.error('❌ Add Recipient Error:', recErr.message);
              pc.close(() => {});
              
              // Enhanced error message for certificate issues
              let errorMessage = recErr.message;
              if (recErr.message.includes('No Direct certificates found')) {
                errorMessage = `Cannot send to "${payload.to}": No Direct certificates found.\n\n` +
                  `Possible causes:\n` +
                  `• The recipient address is not a valid/active Direct address\n` +
                  `• The recipient's certificates are not published in the LDAP/DNS directory\n` +
                  `• The recipient's organization hasn't properly configured their Direct messaging\n\n` +
                  `Please verify:\n` +
                  `1. The recipient address is correct and properly formatted (e.g., provider@example.direct.com)\n` +
                  `2. The recipient has an active Direct messaging account\n` +
                  `3. Try contacting the recipient to confirm their Direct address\n\n` +
                  `For testing in sandbox, use test addresses like: test@test.directproject.net`;
              }
              
              return resolve({
                success: false,
                error: errorMessage,
              });
            }

            console.log('✅ Recipient added:', recipientData);

            // Set subject
            pc.setSubject(payload.subject, (subjErr: Error | null) => {
              if (subjErr) {
                console.error('❌ Set Subject Error:', subjErr.message);
                pc.close(() => {});
                return resolve({
                  success: false,
                  error: `Set subject failed: ${subjErr.message}`,
                });
              }

              // Add message body as text
              pc.addText(payload.body, (textErr: Error | null) => {
                if (textErr) {
                  console.error('❌ Add Text Error:', textErr.message);
                  pc.close(() => {});
                  return resolve({
                    success: false,
                    error: `Add text failed: ${textErr.message}`,
                  });
                }

                // Add attachments if any
                const addAttachments = (index: number) => {
                  if (!payload.attachments || index >= payload.attachments.length) {
                    // All attachments added, now send
                    return sendMessage();
                  }

                  const attachment = payload.attachments[index];
                  pc.addRaw(
                    attachment.content,
                    attachment.filename,
                    (attErr: Error | null) => {
                      if (attErr) {
                        console.error('❌ Add Attachment Error:', attErr.message);
                        pc.close(() => {});
                        return resolve({
                          success: false,
                          error: `Add attachment failed: ${attErr.message}`,
                        });
                      }
                      addAttachments(index + 1);
                    }
                  );
                };

                const sendMessage = () => {
                  // Send the message
                  pc.send((sendErr: Error | null, sendResults: Array<{
                    recipient: string;
                    succeeded: boolean;
                    messageId?: string;
                    errorText?: string;
                  }>) => {
                    pc.close(() => {});

                    if (sendErr) {
                      console.error('❌ Send Error:', sendErr.message);
                      return resolve({
                        success: false,
                        error: `Send failed: ${sendErr.message}`,
                      });
                    }

                    // Process send results
                    const results = sendResults || [];
                    const firstResult = results[0];

                    if (firstResult && firstResult.succeeded) {
                      console.log('✅ EMRDirect - Prescription Sent Successfully!');
                      return resolve({
                        success: true,
                        messageId: firstResult.messageId,
                        details: {
                          to: payload.to,
                          from: payload.from,
                          timestamp: new Date().toISOString(),
                          server: `${this.server}:${this.port}`,
                          recipient: firstResult.recipient,
                          results: results,
                        },
                      });
                    } else {
                      console.error('❌ Send failed:', firstResult?.errorText);
                      return resolve({
                        success: false,
                        error: firstResult?.errorText || 'Send failed with unknown error',
                      });
                    }
                  });
                };

                // Start adding attachments or send if none
                addAttachments(0);
              });
            });
          });
        });
      });
    });
  }
}

/**
 * PHIQUERY Client for querying patient data
 */
export class PHIQueryClient {
  private server: string;
  private port: string;
  private datasource: string;
  private password: string;

  constructor() {
    this.server = process.env.PHIQUERY_SERVER || '';
    this.port = process.env.PHIQUERY_PORT || '';
    this.datasource = process.env.PHIQUERY_DATASOURCE || '';
    this.password = process.env.PHIQUERY_PASSWORD || '';
  }

  /**
   * Query patient medication history via FHIR R4 API
   */
  async queryPatientMedications(patientId: string): Promise<QueryResponse> {
    const queryUrl = `https://${this.server}:${this.port}/fhir/R4/MedicationRequest?patient=${patientId}&_sort=-date&_count=50`;
    
    console.log('🔍 PHIQUERY FHIR - Querying Patient Medications:', {
      server: `${this.server}:${this.port}`,
      datasource: this.datasource,
      patientId,
    });

    const authToken = Buffer.from(`${this.datasource}:${this.password}`).toString('base64');

    try {
      const response = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Accept': 'application/fhir+json',
          'Content-Type': 'application/fhir+json',
          'User-Agent': 'EMRDirect-eRx-Client/1.0',
        },
        signal: AbortSignal.timeout(15000),
      });

      const fhirBundle: FHIRBundle = await response.json();

      if (response.ok) {
        console.log('✅ PHIQUERY - Medications Retrieved:', fhirBundle);
        return {
          success: true,
          data: fhirBundle.entry || [],
          total: fhirBundle.total || 0,
          bundle: fhirBundle,
        };
      } else {
        console.error('❌ PHIQUERY Error:', response.status, fhirBundle);
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: fhirBundle as Record<string, unknown>,
        };
      }
    } catch (error) {
      console.log('❌ PHIQUERY connection failed:', error instanceof Error ? error.message : error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed',
      };
    }
  }
}


/**
 * The publisher on /privacy and /legal, as the server reads it from the environment
 * (app/controllers/legal_controller.ts). An unset field is null and its line is left out.
 */
export interface LegalPublisher {
  name: string | null
  email: string | null
  address: string | null
  phone: string | null
  /** The host in one line: company, address, phone. */
  host: string | null
  /** The host's company alone. */
  hostCompany: string | null
  updated: string | null
}

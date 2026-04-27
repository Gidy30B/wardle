export type OrganizationType = 'UNIVERSITY' | 'HOSPITAL' | 'COLLEGE' | 'OTHER'

export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export type OrganizationMemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED'

export type Organization = {
  id: string
  name: string
  type: OrganizationType
  slug: string | null
  seatPriceCents: number | null
  currency: string | null
  seatLimit: number | null
  createdAt: string
  updatedAt: string
}

export type UserOrganizationMembership = {
  id: string
  role: OrganizationRole
  status: OrganizationMemberStatus
  createdAt: string
  updatedAt: string
  organization: Organization
}

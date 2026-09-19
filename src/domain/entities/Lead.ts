export type LeadStatus = 'nuevo' | 'contactado' | 'convertido' | 'descartado';
export type WeeklyQuestions = '<10' | '10-50' | '50-200' | '200+';

export interface LeadProps {
  id: string;
  name: string;
  email: string;
  phone: string;
  mlStore: string;
  weeklyQuestions: WeeklyQuestions;
  qualified: boolean;
  status: LeadStatus;
  createdAt?: Date;
}

export class Lead {
  public readonly id: string;
  public readonly name: string;
  public readonly email: string;
  public readonly phone: string;
  public readonly mlStore: string;
  public readonly weeklyQuestions: WeeklyQuestions;
  public readonly qualified: boolean;
  public status: LeadStatus;
  public readonly createdAt: Date;

  constructor(props: LeadProps) {
    this.id = props.id;
    this.name = props.name.trim();
    this.email = props.email.toLowerCase().trim();
    this.phone = props.phone.trim();
    this.mlStore = props.mlStore.trim();
    this.weeklyQuestions = props.weeklyQuestions;
    this.qualified = props.qualified;
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
  }
}

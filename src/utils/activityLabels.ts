import type { ActionType, ActivityEntityType } from '../types';
import { Receipt, ListTodo, Home, FileText, Tags, Bell } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const ACTION_LABELS: Record<ActionType, string> = {
  bill_added: 'Bill added',
  bill_updated: 'Bill updated',
  bill_paid: 'Bill paid',
  bill_postponed: 'Bill postponed',
  bill_deleted: 'Bill deleted',
  bill_restored: 'Bill restored',
  todo_added: 'To-do added',
  todo_updated: 'To-do updated',
  todo_done: 'To-do done',
  todo_recurrence_created: 'Recurrence created',
  todo_postponed: 'To-do postponed',
  todo_deleted: 'To-do deleted',
  todo_restored: 'To-do restored',
  property_added: 'Property added',
  property_updated: 'Property updated',
  property_deleted: 'Property deleted',
  property_restored: 'Property restored',
  billtype_added: 'Bill type added',
  billtype_updated: 'Bill type updated',
  billtype_deleted: 'Bill type deleted',
  billtype_restored: 'Bill type restored',
  category_added: 'Category added',
  category_updated: 'Category updated',
  category_deleted: 'Category deleted',
  category_restored: 'Category restored',
  push_enabled: 'Push enabled',
  push_disabled: 'Push disabled',
};

export const ENTITY_ICONS: Record<ActivityEntityType, LucideIcon> = {
  bill: Receipt,
  todo: ListTodo,
  property: Home,
  billtype: FileText,
  category: Tags,
  push_subscription: Bell,
};

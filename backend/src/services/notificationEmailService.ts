/**
 * Orchestrates in-app notifications + email for key events.
 * Call these from routes after the main action succeeds.
 */
import { Pool } from 'mysql2/promise';
import { NotificationService } from './notificationService';
import {
  sendGroupingAndSupervisorEmail,
  sendSupervisorFeedbackEmail,
  sendSubmissionConfirmationEmail,
  sendSupervisorMessageEmail,
  sendNewStudentAssignmentEmail,
  sendStudentSubmissionEmail,
  sendStudentMessageEmail,
  sendUnassignedStudentsAlertEmail,
  sendDefenseScheduledEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendProfileUpdateConfirmationEmail,
  sendSessionSecurityAlertEmail,
  isEmailConfigured,
} from './emailService';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export async function notifyGroupingAndSupervisor(
  db: Pool,
  studentUserIds: number[],
  studentEmails: string[],
  studentNames: string[],
  groupNumber: string,
  supervisorName: string
): Promise<void> {
  const ns = new NotificationService(db);
  const title = `Grouped in ${groupNumber} - Assigned to ${supervisorName}`;
  const message = `You've been grouped with ${groupNumber} and assigned to ${supervisorName} as your project supervisor.`;

  for (let i = 0; i < studentUserIds.length; i++) {
    await ns.create({
      userId: studentUserIds[i],
      title,
      message,
      type: 'supervisor_assigned',
      actionUrl: `${FRONTEND_URL}/student/my-group`,
    });
    if (isEmailConfigured() && studentEmails[i]) {
      sendGroupingAndSupervisorEmail(studentEmails[i], studentNames[i], groupNumber, supervisorName).catch(() => {});
    }
  }
}

export async function notifySupervisorFeedback(
  db: Pool,
  studentUserId: number,
  studentEmail: string,
  studentName: string,
  supervisorName: string,
  reportTitle: string,
  feedbackSummary: string,
  approved: boolean,
  requiredChanges?: string
): Promise<void> {
  const ns = new NotificationService(db);
  const status = approved ? 'Approved' : 'Changes required';
  const title = `${supervisorName} reviewed your ${reportTitle}`;
  const message = `Status: ${status}. ${feedbackSummary}`;

  await ns.create({
    userId: studentUserId,
    title,
    message,
    type: 'report_reviewed',
    actionUrl: `${FRONTEND_URL}/student/reports`,
  });
  if (isEmailConfigured() && studentEmail) {
    sendSupervisorFeedbackEmail(
      studentEmail,
      studentName,
      supervisorName,
      reportTitle,
      feedbackSummary,
      approved,
      requiredChanges
    ).catch(() => {});
  }
}

export async function notifySubmissionConfirmation(
  db: Pool,
  studentUserId: number,
  studentEmail: string,
  studentName: string,
  reportTitle: string,
  fileName: string
): Promise<void> {
  const ns = new NotificationService(db);
  const title = `${reportTitle} submitted successfully`;
  const message = `Your ${reportTitle} has been submitted. Awaiting review.`;
  const timestamp = new Date().toLocaleString();

  await ns.create({
    userId: studentUserId,
    title,
    message,
    type: 'report_submitted',
    actionUrl: `${FRONTEND_URL}/student/reports`,
  });
  if (isEmailConfigured() && studentEmail) {
    sendSubmissionConfirmationEmail(studentEmail, studentName, reportTitle, fileName, timestamp).catch(() => {});
  }
}

export async function notifySupervisorMessage(
  db: Pool,
  recipientUserId: number,
  recipientEmail: string,
  recipientName: string,
  senderName: string,
  messageSubject: string,
  messagePreview: string
): Promise<void> {
  const ns = new NotificationService(db);
  const title = `New message from ${senderName}`;
  const message = messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview;

  await ns.create({
    userId: recipientUserId,
    title,
    message,
    type: 'message_received',
    actionUrl: `${FRONTEND_URL}/student/messages`,
  });
  if (isEmailConfigured() && recipientEmail) {
    sendSupervisorMessageEmail(recipientEmail, recipientName, senderName, messagePreview, messageSubject).catch(() => {});
  }
}

export async function notifyNewStudentAssignment(
  db: Pool,
  supervisorUserId: number,
  supervisorEmail: string,
  supervisorName: string,
  studentCount: number,
  groupCount: number
): Promise<void> {
  const ns = new NotificationService(db);
  const title = `${studentCount} new student${studentCount > 1 ? 's' : ''} assigned to you`;
  const message = `You have ${studentCount} student${studentCount > 1 ? 's' : ''} (${groupCount} group${groupCount > 1 ? 's' : ''}) under your supervision.`;

  await ns.create({
    userId: supervisorUserId,
    title,
    message,
    type: 'supervisor_assigned',
    actionUrl: `${FRONTEND_URL}/supervisor/my-groups`,
  });
  if (isEmailConfigured() && supervisorEmail) {
    sendNewStudentAssignmentEmail(supervisorEmail, supervisorName, studentCount, groupCount).catch(() => {});
  }
}

export async function notifyStudentSubmission(
  db: Pool,
  supervisorUserId: number,
  supervisorEmail: string,
  supervisorName: string,
  studentName: string,
  submissionTitle: string,
  fileName: string
): Promise<void> {
  const ns = new NotificationService(db);
  const title = `${studentName} submitted ${submissionTitle}`;
  const message = `File: ${fileName}. Awaiting your review.`;

  await ns.create({
    userId: supervisorUserId,
    title,
    message,
    type: 'report_submitted',
    actionUrl: `${FRONTEND_URL}/supervisor/report-reviews`,
  });
  if (isEmailConfigured() && supervisorEmail) {
    sendStudentSubmissionEmail(supervisorEmail, supervisorName, studentName, submissionTitle, fileName).catch(() => {});
  }
}

export async function notifyStudentMessage(
  db: Pool,
  recipientUserId: number,
  recipientEmail: string,
  recipientName: string,
  senderName: string,
  messageSubject: string,
  messagePreview: string
): Promise<void> {
  const ns = new NotificationService(db);
  const title = `${senderName} sent you a message`;
  const message = messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview;

  await ns.create({
    userId: recipientUserId,
    title,
    message,
    type: 'message_received',
    actionUrl: `${FRONTEND_URL}/supervisor/messages`,
  });
  if (isEmailConfigured() && recipientEmail) {
    sendStudentMessageEmail(recipientEmail, recipientName, senderName, messagePreview, messageSubject).catch(() => {});
  }
}

export async function notifyUnassignedStudentsAlert(
  db: Pool,
  adminUserIds: number[],
  adminEmails: string[],
  department: string,
  studentList: string[],
  count: number
): Promise<void> {
  const ns = new NotificationService(db);
  const title = `${count} students in ${department} need supervisor assignment`;
  const message = studentList.slice(0, 5).join(', ') + (studentList.length > 5 ? ` and ${studentList.length - 5} more` : '');

  for (let i = 0; i < adminUserIds.length; i++) {
    await ns.create({
      userId: adminUserIds[i],
      title,
      message,
      type: 'system_update',
      priority: 'high',
      actionUrl: `${FRONTEND_URL}/admin/supervisor-assignment`,
    });
    if (isEmailConfigured() && adminEmails[i]) {
      sendUnassignedStudentsAlertEmail(adminEmails[i], department, studentList, count).catch(() => {});
    }
  }
}

export async function notifyDefenseScheduled(
  db: Pool,
  studentUserId: number,
  studentEmail: string,
  studentName: string,
  venue: string,
  assessors: string[],
  groupName?: string
): Promise<void> {
  const ns = new NotificationService(db);
  const assessorsStr = Array.isArray(assessors) && assessors.length > 0 ? assessors.join(', ') : 'To be announced';
  const title = 'Defense schedule published';
  const message = `Venue: ${venue}. Assessors: ${assessorsStr}.`;

  await ns.create({
    userId: studentUserId,
    title,
    message,
    type: 'defense_scheduled',
    priority: 'high',
    actionUrl: `${FRONTEND_URL}/dashboard`,
  });
  if (isEmailConfigured() && studentEmail) {
    sendDefenseScheduledEmail(studentEmail, studentName, venue, assessors, groupName).catch(() => {});
  }
}

export async function sendWelcomeEmailOnly(
  email: string,
  firstName: string,
  role: string,
  tempPassword?: string
): Promise<void> {
  if (isEmailConfigured()) {
    sendWelcomeEmail(email, firstName, email, role, tempPassword).catch(() => {});
  }
}

export async function sendPasswordResetEmailOnly(
  email: string,
  firstName: string,
  resetLink: string,
  expiryMinutes: number = 60
): Promise<void> {
  if (isEmailConfigured()) {
    sendPasswordResetEmail(email, firstName, resetLink, expiryMinutes).catch(() => {});
  }
}

export async function sendProfileUpdateEmailOnly(
  email: string,
  firstName: string,
  changes: string[],
  timestamp: string
): Promise<void> {
  if (isEmailConfigured()) {
    sendProfileUpdateConfirmationEmail(email, firstName, changes, timestamp).catch(() => {});
  }
}

export async function sendSessionSecurityAlertOnly(
  email: string,
  firstName: string,
  deviceInfo: string,
  location: string,
  time: string,
  secureAccountLink: string
): Promise<void> {
  if (isEmailConfigured()) {
    sendSessionSecurityAlertEmail(email, firstName, deviceInfo, location, time, secureAccountLink).catch(() => {});
  }
}

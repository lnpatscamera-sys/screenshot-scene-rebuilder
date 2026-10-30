import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';
import type { TemplateEntry } from './registry';

type Props = { name?: string; username?: string; password?: string; officialEmail?: string | null; loginUrl?: string };

function StaffAccountEmail({ name, username, password, officialEmail, loginUrl }: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your LNPATS ERP staff account is ready</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ padding: '24px', maxWidth: '560px' }}>
          <Heading style={{ color: '#14213d' }}>Welcome to LNPATS ERP</Heading>
          <Text>Dear {name ?? 'Officer'},</Text>
          <Text>The Human Resources Section has opened your staff account on the LNPATS ERP system.</Text>
          <Text style={{ background: '#f4f1e6', padding: '12px 16px', borderRadius: '6px' }}>
            Username (LNP ID Number): <strong>{username}</strong><br />
            Default password: <strong>{password}</strong>
            {officialEmail && <><br />Official email address: <strong>{officialEmail}</strong></>}
          </Text>
          {officialEmail && <Text>Your official email address has been assigned; ICT will tell you when its mailbox is ready.</Text>}
          <Text>You must change this password the first time you sign in. Do not share it with anyone.</Text>
          {loginUrl && <Button href={loginUrl} style={{ backgroundColor: '#14213d', color: '#ffffff', padding: '10px 18px', borderRadius: '6px' }}>Sign in</Button>}
          <Text>Liberia National Police Academy and Training School</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: StaffAccountEmail,
  subject: 'Your LNPATS ERP staff account',
  displayName: 'Staff account created',
  previewData: { name: 'John Doe', username: 'LNP-12345', password: 'Temp-Abc123!', officialEmail: 'j.doe@lnpats.net', loginUrl: 'https://lnpats-erp.lovable.app/auth' },
} satisfies TemplateEntry;

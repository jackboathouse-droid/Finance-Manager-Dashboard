import { Link } from "wouter";
import { BubbleLogo } from "@/components/bubble-logo";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border/50 bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <BubbleLogo size="sm" />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: 30 March 2026</p>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Bubble Finance ("Bubble", "we", "us", or "our") is committed to protecting your personal
          information and your right to privacy. This policy explains what data we collect, how we
          use it, and what rights you have over it. If you have any questions, please contact us at{" "}
          <a
            href="mailto:privacy@bubble.app"
            className="text-primary underline underline-offset-4 hover:opacity-80"
          >
            privacy@bubble.app
          </a>
          .
        </p>

        <Section title="1. What data we collect">
          <p>
            When you create an account and use Bubble, we collect the following categories of personal
            data:
          </p>
          <ul>
            <li>
              <strong>Account information:</strong> your name, email address, and (if you use email
              sign-in) a securely hashed version of your password. We never store your password in
              plain text.
            </li>
            <li>
              <strong>Financial data you enter:</strong> bank accounts, transactions, budgets,
              savings projects, and manual assets or liabilities that you add directly to the app.
            </li>
            <li>
              <strong>Usage data:</strong> your app settings (currency, date format, notification
              preferences) and session information to keep you logged in.
            </li>
            <li>
              <strong>Google account data (optional):</strong> if you choose to sign in with Google,
              we receive your name, email address, and profile picture from Google. We do not receive
              access to your Google contacts, Drive, Gmail, or any other Google service.
            </li>
          </ul>
          <p>
            We do <strong>not</strong> connect to your real bank accounts. All financial data in
            Bubble is entered manually by you.
          </p>
        </Section>

        <Section title="2. How we use your data">
          <p>We use your data solely to provide and improve the Bubble service:</p>
          <ul>
            <li>To authenticate you and keep your account secure.</li>
            <li>To display your personal finance dashboard, reports, and insights.</li>
            <li>
              To send you transactional emails (password reset links, budget alerts, weekly
              summaries) — only if you have enabled these in Settings.
            </li>
            <li>To generate AI-powered financial insights using your transaction history.</li>
          </ul>
          <p>
            We do <strong>not</strong> sell, share, or rent your personal data to any third parties
            for marketing purposes.
          </p>
        </Section>

        <Section title="3. How we store and protect your data">
          <ul>
            <li>
              All data is stored in a PostgreSQL database hosted on secure, access-controlled
              infrastructure.
            </li>
            <li>
              Passwords are stored as bcrypt hashes with a cost factor of 12. No one at Bubble can
              read your password.
            </li>
            <li>
              All data in transit is encrypted using TLS (HTTPS). Cookies are set with{" "}
              <code>HttpOnly</code>, <code>Secure</code>, and <code>SameSite</code> flags.
            </li>
            <li>
              Each user's data is fully isolated — other users cannot access your financial
              information.
            </li>
          </ul>
        </Section>

        <Section title="4. Data retention">
          <p>
            We retain your data for as long as your account is active. If you delete your account,
            all of your personal data — including transactions, accounts, budgets, assets, and
            settings — is permanently and immediately deleted from our database. This action is
            irreversible.
          </p>
          <p>
            We do not retain backups of your data after account deletion beyond any automated backup
            window (typically 7 days), after which your data is fully purged.
          </p>
        </Section>

        <Section title="5. Your rights (GDPR / PIPEDA)">
          <p>
            Depending on where you are located, you may have the following rights regarding your
            personal data:
          </p>
          <ul>
            <li>
              <strong>Right of access:</strong> you can download a full export of all data we hold
              about you from Settings → Privacy → Download my data.
            </li>
            <li>
              <strong>Right to erasure ("right to be forgotten"):</strong> you can permanently
              delete your account and all associated data from Settings → Danger Zone → Delete my
              account.
            </li>
            <li>
              <strong>Right to rectification:</strong> you can update your personal information
              directly within the app at any time.
            </li>
            <li>
              <strong>Right to portability:</strong> your data export is provided as standard JSON,
              which you can use with other services.
            </li>
          </ul>
          <p>
            To exercise any of these rights, or if you have concerns about how we handle your data,
            please contact{" "}
            <a
              href="mailto:privacy@bubble.app"
              className="text-primary underline underline-offset-4 hover:opacity-80"
            >
              privacy@bubble.app
            </a>
            .
          </p>
        </Section>

        <Section title="6. Third-party services">
          <p>Bubble uses the following third-party services to operate:</p>
          <ul>
            <li>
              <strong>OpenAI:</strong> transaction descriptions and financial summaries may be sent
              to OpenAI's API to generate AI insights. No other personal data (name, email, account
              numbers) is sent. OpenAI's privacy policy applies to this processing.
            </li>
            <li>
              <strong>Google OAuth (optional):</strong> if you sign in with Google, your
              authentication is handled by Google's identity platform.
            </li>
          </ul>
        </Section>

        <Section title="7. Cookies">
          <p>
            Bubble uses a single session cookie (<code>connect.sid</code>) to keep you logged in.
            This cookie is essential for the app to function and does not contain any personal
            information beyond a session identifier. We do not use any advertising, tracking, or
            analytics cookies.
          </p>
        </Section>

        <Section title="8. Changes to this policy">
          <p>
            If we make material changes to this Privacy Policy, we will update the "Last updated"
            date at the top of this page. Continued use of Bubble after any changes constitutes
            your acceptance of the new policy.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            For any privacy-related questions, requests, or concerns, please contact us at:{" "}
            <a
              href="mailto:privacy@bubble.app"
              className="text-primary underline underline-offset-4 hover:opacity-80"
            >
              privacy@bubble.app
            </a>
          </p>
        </Section>

        <div className="pt-4 border-t border-border/50 text-sm text-muted-foreground">
          Bubble Finance · Your personal finance companion
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_strong]:text-foreground [&_code]:font-mono [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
        {children}
      </div>
    </section>
  );
}

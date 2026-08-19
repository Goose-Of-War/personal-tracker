import { Link } from "react-router-dom";

export default function Legal() {
  return (
    <div className="page">
      <Link to="/login" className="link-button">
        ← Back
      </Link>
      <h1>Privacy Policy &amp; Terms of Use</h1>
      <p className="page-hint">
        Last updated: whenever we remembered to write this. Read it, don't read it — either way,
        by using this app you're agreeing to it.
      </p>

      <h2>Privacy Policy</h2>
      <ol>
        <li>
          We store what you type in: your username, your expenses, your questionable 2am food
          delivery habits. That's the whole database.
        </li>
        <li>
          This is a personal project running on free-tier infrastructure, held together by hope
          and one (1) `.env` file. It has not been professionally audited, penetration tested, or
          blessed by a security expert. Treat it accordingly.
        </li>
        <li>
          Your data could, in theory, be lost, leaked, corrupted, or misused — not because we plan
          to do anything sinister with it, but because "a hobby project with no SLA" is not a
          promise of safety. If you wouldn't put it in a group chat, don't put it in here.
        </li>
        <li>
          We do not sell your data, mostly because nobody is buying a spreadsheet of your grocery
          runs. We're not doing anything special to protect it either, beyond what's already
          standard (hashed passwords, HTTPS). No dedicated security team, no bug bounty, no
          fancy compliance certificate.
        </li>
      </ol>

      <h2>Terms of Use</h2>
      <ol>
        <li>
          You use this app entirely at your own risk. If it eats your data, miscalculates your
          net worth, or is simply down because someone forgot to renew something, that's on you
          for trusting a side project with your finances.
        </li>
        <li>This is not financial advice, financial software, or a bank. It is a glorified list.</li>
        <li>
          No warranty of any kind — expressed, implied, or whispered hopefully into the void — is
          provided. Not "fit for purpose," not "reliable," not "definitely won't lose your
          March transactions."
        </li>
        <li>
          By creating an account and using this app, you agree to all of the above: the risk, the
          possibility of misuse, the lack of guarantees, all of it. Congratulations, you consented.
        </li>
      </ol>

      <p className="page-hint">
        Questions, complaints, or existential dread about your data? There's no support line.
        Godspeed.
      </p>
    </div>
  );
}

declare module 'nodemailer' {
  interface MailOptions {
    from: string
    to: string
    subject: string
    html: string
  }

  interface Transporter {
    sendMail(options: MailOptions): Promise<unknown>
  }

  function createTransport(options: unknown): Transporter

  const nodemailer: {
    createTransport: typeof createTransport
  }

  export default nodemailer
}

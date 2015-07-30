# Preview all emails at http://localhost:3000/rails/mailers/contact_mailer
class ContactMailerPreview < ActionMailer::Preview

  # Preview this email at http://localhost:3000/rails/mailers/contact_mailer/send_contact
  def send_contact
    from = 'sample@driftingruby.com'
    subject = 'Site Feedback'
    message = 'You should really have more episodes about different taco flavorings.'
    ContactMailer.send_contact(from,subject,message)
  end

end

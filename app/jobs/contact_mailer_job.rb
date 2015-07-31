class ContactMailerJob < ActiveJob::Base
  queue_as :default

  def perform(from,subject,message)
    ContactMailer.send_contact(from,subject,message)
  end
end

class VisitorsController < ApplicationController
  invisible_captcha only: :send_contact, on_spam: :spam_detected

  def contact
  end

  def send_contact
    from = params[:contact][:from]
    subject = params[:contact][:subject]
    message = params[:contact][:message]
    # ContactMailer.send_contact(from,subject,message).deliver_now
    ContactMailerJob.perform_later(from,subject,message)
    redirect_to root_url, notice: 'Your message has been sent!'
  end

  private

  def spam_detected
    redirect_to root_path, alert: 'Spam detected.'
  end
end

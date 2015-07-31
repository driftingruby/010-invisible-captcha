class VisitorsController < ApplicationController
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
end

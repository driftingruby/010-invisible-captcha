class VisitorsController < ApplicationController
  def contact
  end

  def send_contact
    redirect_to root_url, notice: 'Your message has been sent!'
  end
end

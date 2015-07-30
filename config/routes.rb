Rails.application.routes.draw do
  get :contact, to: 'visitors#contact'
  post :contact, to: 'visitors#send_contact'
  root to: 'visitors#index'
end

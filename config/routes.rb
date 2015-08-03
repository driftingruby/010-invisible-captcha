Rails.application.routes.draw do
  resources :users
  get :contact, to: 'visitors#contact'
  post :contact, to: 'visitors#send_contact'
  root to: 'visitors#index'
end

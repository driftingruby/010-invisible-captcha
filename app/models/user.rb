class User < ActiveRecord::Base
  attr_accessor :name
  validates :name, invisible_captcha: true
end

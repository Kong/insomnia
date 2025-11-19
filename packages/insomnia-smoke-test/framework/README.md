# Wrapper design
1. Seperate framework and case. Use two different folder, such as "framework" and "tests". Wrapper actions and workflow in framework so that user can focus on test scenarios in case layer rather than locator and actions.

2. For framework, seperate two layers, page layer and workflow layer. 
3. Seperate locator, action and assertion in each page layer. It brings two benefits, for one, the locators of the specific can be maintained in one area; plus, the common action and workflow can be reused in case layer without caring about the locator.

4. For case, define one data file for one case. eg. fixtures/smoke/demo.json and tests/smoke/demo.test.ts. If one data file needs to be shared, add 'common' as prefix in file name
5. Base case need to redesign. It should do all the initialization steps, such as test environment and loading the first page. Login once if necessary.

# Demo code
framework: /packages/framework
case: /tests/smoke/demo.test.ts

# The goal status
I try to use these codes to show my design thinking... To meet the basic requirement, I should have debug pass one simple case, but some actions cannot work such as fill text in input control. I need to learn more about playwright actions.





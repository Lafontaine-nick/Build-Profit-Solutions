/*
 * ESTIMATE GENERATOR - PART 2B of 5
 * 
 * This part contains (second half of original Part 2):
 * - UI rendering logic for various steps (continuation)
 * - Form inputs and handlers (continuation)
 * - Modal components
 * - Step navigation logic
 * 
 * Lines: 6208-8267 (approximately)
 */

                end={{ x: 0.95, y: 0.85 }}
                style={{
                  borderRadius: 20,
                  padding: 1,
                  marginBottom: 12,
                  marginTop: 12,
                }}
              >
                <View style={{
                  backgroundColor: '#000000',
                  borderRadius: 18,
                  padding: 20,
                }}>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 4 }}>
                      Cost Breakdown
                    </Text>
                    <Text style={{ color: Colors.sub, fontSize: 13 }}>
                      Materials, labor, overhead & markup
                    </Text>
                  </View>
                  {/* Full width cards with grey border and background */}
                  <View style={{ gap: 12 }}>
                    <View style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 18, 
                      padding: 16, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6', marginRight: 10 }} />
                        <Text style={{ color: Colors.sub, fontSize: 14 }}>Materials</Text>
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700' }}>{money(calc.materials)}</Text>
                    </View>
                    
                    <View style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 18, 
                      padding: 16, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e', marginRight: 10 }} />
                        <Text style={{ color: Colors.sub, fontSize: 14 }}>Labor</Text>
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700' }}>{money(calc.labor)}</Text>
                    </View>
                    
                    <View style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 18, 
                      padding: 16, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#f59e0b', marginRight: 10 }} />
                        <Text style={{ color: Colors.sub, fontSize: 14 }}>Overhead</Text>
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700' }}>{money(calc.overhead)}</Text>
                    </View>
                    
                    <View style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 18, 
                      padding: 16, 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#a78bfa', marginRight: 10 }} />
                        <Text style={{ color: Colors.sub, fontSize: 14 }}>Markup ({bid.markupPct || 0}%)</Text>
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700' }}>{money(calc.profit)}</Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
              
              {/* Project Actions - no border */}
              <View style={{
                paddingTop: 24,
                paddingBottom: 24,
                backgroundColor: Colors.card,
                marginBottom: 0,
              }}>
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 2 }}>
                    Project Actions
                  </Text>
                  <Text style={{ color: Colors.sub, fontSize: 13 }}>
                    Save, submit or mark as won • Estimates save automatically
                  </Text>
                </View>
                
                  {/* Action Buttons Grid - grey buttons, Mark as Won has green-to-blue background */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {/* Save Bid - grey button */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={{ 
                        flex: 1, 
                        minWidth: '47%', 
                        backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 18, 
                        paddingVertical: 10, 
                        paddingHorizontal: 12 
                      }}
                      onPress={saveCurrentEstimate}
                    >
                      <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                        <Ionicons name="save-outline" size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Save Bid</Text>
                      </View>
                    </TouchableOpacity>
                    
                    {/* Restore Bids - only show if there are saved bids */}
                    {savedEstimates.length > 0 && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={{ 
                          flex: 1, 
                          minWidth: '47%', 
                          backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: 18, 
                          paddingVertical: 10, 
                          paddingHorizontal: 12 
                        }}
                        onPress={() => setShowRecoveryModal(true)}
                      >
                        <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                          <Ionicons name="refresh-outline" size={16} color="#fff" />
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                            Restore Bids {savedEstimates.length > 0 && `(${savedEstimates.length})`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    
                    {/* Submit Bid */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={{ 
                        flex: 1, 
                        minWidth: '47%', 
                        backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 18, 
                        paddingVertical: 10, 
                        paddingHorizontal: 12 
                      }}
                      onPress={handleSubmitBid}
                    >
                      <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                        <Ionicons name="send-outline" size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Submit Bid</Text>
                      </View>
                    </TouchableOpacity>
                    
                    {/* Mark as Won - green to blue background */}
                    <LinearGradient
                      colors={['#2DFFC4', '#00A6FF']}
                      start={{ x: 0.05, y: 0.15 }}
                      end={{ x: 0.95, y: 0.85 }}
                      style={{ flex: 1, minWidth: '47%', borderRadius: 18 }}
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={{ 
                          borderRadius: 18, 
                          paddingVertical: 10, 
                          paddingHorizontal: 12 
                        }}
                        onPress={handleMarkAsWon}
                      >
                        <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                          <Ionicons name="trophy-outline" size={16} color="#000" />
                          <Text style={{ color: '#000', fontSize: 13, fontWeight: '700' }}>Mark as Won</Text>
                        </View>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
              </View>
            </View>
        );
      }
      
      case 1: {
        return (
          <View style={[s.wideContainer, { marginTop: 16 }]}>
            <GlassBorderCard radius={24} innerRadius={22} pad={20}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="person" size={20} color="#2DFFC4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Customer Information</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Client contact details and preferences</Text>
                </View>
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Customer Name *</Text>
                <TextInput
                  key="customerName"
                  style={s.input}
                  placeholder="Enter customer name"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerName || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerName: text }));
                  }}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Email</Text>
                <TextInput
                  key="customerEmail"
                  style={s.input}
                  placeholder="customer@example.com"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerEmail || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerEmail: text }));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Phone</Text>
                <TextInput
                  key="customerPhone"
                  style={s.input}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerPhone || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerPhone: text }));
                  }}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Address</Text>
                <TextInput
                  key="customerAddress"
                  style={s.input}
                  placeholder="Street address"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerAddress || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerAddress: text }));
                  }}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={[s.inputGroup, { width: '48%' }]}>
                  <Text style={s.label}>City</Text>
                  <TextInput
                    key="customerCity"
                    style={s.input}
                    placeholder="City"
                    placeholderTextColor={Colors.sub}
                    value={bid.customerCity || ''}
                    onChangeText={(text) => {
                      setBid(prev => ({ ...prev, customerCity: text }));
                    }}
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    blurOnSubmit={true}
                  />
                </View>
                
                <View style={[s.inputGroup, { width: '48%' }]}>
                  <Text style={s.label}>State</Text>
                  <TextInput
                    key="customerState"
                    style={s.input}
                    placeholder="State"
                    placeholderTextColor={Colors.sub}
                    value={bid.customerState || ''}
                    onChangeText={(text) => {
                      setBid(prev => ({ ...prev, customerState: text }));
                    }}
                    maxLength={2}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    blurOnSubmit={true}
                  />
                </View>
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>ZIP Code</Text>
                <TextInput
                  key="customerZip"
                  style={s.input}
                  placeholder="12345"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerZip || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerZip: text }));
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Company (Optional)</Text>
                <TextInput
                  key="customerCompany"
                  style={[s.input, { color: Colors.text }]}
                  placeholder="Company name"
                  placeholderTextColor={Colors.sub}
                  value={bid.customerCompany || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerCompany: text }));
                  }}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Notes</Text>
                <TextInput
                  key="customerNotes"
                  style={[s.input, { minHeight: 100, textAlignVertical: 'top', color: Colors.text }]}
                  placeholder="Additional notes about the customer..."
                  placeholderTextColor={Colors.sub}
                  value={bid.customerNotes || ''}
                  onChangeText={(text) => {
                    setBid(prev => ({ ...prev, customerNotes: text }));
                  }}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </GlassBorderCard>
          </View>
        );
      }
      
      case 2: {
        return (
          <View style={[s.wideContainer, { marginTop: 16 }]}>
            <GlassBorderCard radius={24} innerRadius={22} pad={20}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="information-circle" size={20} color="#2DFFC4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Project Information</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Core details drive unit pricing and regional adjustments</Text>
                </View>
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Project Title *</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="e.g., Kitchen Renovation"
                  placeholderTextColor={Colors.sub}
                  value={bid.title || ''}
                  onChangeText={(text) => updateBid('title', text)}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Project Type</Text>
                <View style={s.chipRow}>
                  {PROJECT_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[s.chip, bid.projectType === type.value && s.chipActive]}
                      onPress={() => updateBid('projectType', type.value)}
                    >
                      <Text style={[s.chipText, bid.projectType === type.value && { color: '#2DFFC4' }]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Square Footage</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="1250"
                  placeholderTextColor={Colors.sub}
                  value={bid.sqft?.toString() || ''}
                  onChangeText={(text) => updateBid('sqft', parseInt(text) || 0)}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Project Description</Text>
                <TextInput
                  style={[s.input, { minHeight: 120, textAlignVertical: 'top', color: Colors.text }]}
                  placeholder="Describe the project scope, requirements, and special considerations..."
                  placeholderTextColor={Colors.sub}
                  value={bid.scopeDescription || ''}
                  onChangeText={(text) => updateBid('scopeDescription', text)}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                  multiline
                  numberOfLines={6}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Start Date</Text>
                <TouchableOpacity
                  style={s.input}
                  onPress={() => setShowStartDateCalendar(!showStartDateCalendar)}
                >
                  <Text style={{ color: bid.startDate ? Colors.text : Colors.sub }}>
                    {bid.startDate ? new Date(bid.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select start date'}
                  </Text>
                </TouchableOpacity>
                {showStartDateCalendar && (
                  <View style={{ marginTop: 8 }}>
                    <GreyCalendar
                      onDayPress={(day) => {
                        updateBid('startDate', day.dateString);
                        setShowStartDateCalendar(false);
                      }}
                      markedDates={{
                        [bid.startDate || '']: {
                          selected: true,
                          selectedColor: '#38d39f',
                          selectedTextColor: '#000000',
                        }
                      }}
                      initialDate={bid.startDate}
                    />
                  </View>
                )}
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>End Date</Text>
                <TouchableOpacity
                  style={s.input}
                  onPress={() => setShowEndDateCalendar(!showEndDateCalendar)}
                >
                  <Text style={{ color: bid.endDate ? Colors.text : Colors.sub }}>
                    {bid.endDate ? new Date(bid.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select end date'}
                  </Text>
                </TouchableOpacity>
                {showEndDateCalendar && (
                  <View style={{ marginTop: 8 }}>
                    <GreyCalendar
                      onDayPress={(day) => {
                        updateBid('endDate', day.dateString);
                        setShowEndDateCalendar(false);
                      }}
                      markedDates={{
                        [bid.endDate || '']: {
                          selected: true,
                          selectedColor: '#38d39f',
                          selectedTextColor: '#000000',
                        }
                      }}
                      initialDate={bid.endDate}
                    />
                  </View>
                )}
              </View>
            </GlassBorderCard>
          </View>
        );
      }
      
      case 3: {
        const sections = SECTIONS[activeScope] || SECTIONS.other;
        
        return (
          <>
            <View style={[s.wideContainer, { marginTop: 16 }]}>
                {/* Header */}
                <GlassBorderCard radius={24} innerRadius={22} pad={20}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Ionicons name="cube-outline" size={20} color="#2DFFC4" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Materials & Supplies</Text>
                      <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Live pricing and inflation tracking</Text>
                    </View>
                  </View>
                  
                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: materialModal.visible ? Colors.primary : 'rgba(255, 255, 255, 0.05)',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: materialModal.visible ? Colors.primary : 'rgba(255, 255, 255, 0.15)',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                      }}
                      onPress={() => setMaterialModal({ visible: true, item: null })}
                    >
                      <Ionicons name="add" size={18} color={materialModal.visible ? '#fff' : Colors.text} style={{ marginRight: 6 }} />
                      <Text style={{ color: materialModal.visible ? '#fff' : Colors.text, fontSize: 14, fontWeight: '600' }}>Add Material</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: skuModalVisible ? Colors.primary : 'rgba(255, 255, 255, 0.05)',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: skuModalVisible ? Colors.primary : 'rgba(255, 255, 255, 0.15)',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                      }}
                      onPress={() => {
                        console.log('🔍 SKU Search button pressed');
                        console.log('🔍 Current skuModalVisible state:', skuModalVisible);
                        console.log('🔍 Setting skuModalVisible to true');
                        setSkuModalVisible(true);
                        // Force a re-render check
                        setTimeout(() => {
                          console.log('🔍 After setState - skuModalVisible should be true');
                        }, 100);
                      }}
                    >
                      <Ionicons name="barcode-outline" size={18} color={skuModalVisible ? '#fff' : Colors.primary} style={{ marginRight: 8 }} />
                      <Text style={{ color: skuModalVisible ? '#fff' : Colors.text, fontSize: 14, fontWeight: '600' }}>SKU Search</Text>
                    </TouchableOpacity>
                  </View>
                </GlassBorderCard>
                
                {/* Materials Cart Summary */}
                <View style={{ marginTop: 16 }}>
                  <GlassBorderCard radius={24} innerRadius={22} pad={20}>
                    <TouchableOpacity
                      onPress={() => setIsCartExpanded(!isCartExpanded)}
                      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isCartExpanded ? 16 : 0 }}
                      activeOpacity={0.7}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(34, 197, 94, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Ionicons name="cart-outline" size={16} color="#22c55e" />
                      </View>
                      <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
                        Materials Cart
                      </Text>
                      {materialsCart.length > 0 && (
                        <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 }}>
                          <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '700' }}>
                            {materialsCart.length}
                          </Text>
                        </View>
                      )}
                      <Ionicons
                        name={isCartExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={Colors.sub}
                      />
                    </TouchableOpacity>
                    
                    {isCartExpanded && (
                      <>
                        {materialsCart.length === 0 ? (
                          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                              <Ionicons name="cart-outline" size={28} color={Colors.sub} />
                            </View>
                            <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
                              Your cart is empty
                            </Text>
                            <Text style={{ color: Colors.sub, fontSize: 13, textAlign: 'center' }}>
                              Add materials from the catalog below
                            </Text>
                          </View>
                        ) : (
                          <>
                            {materialsCart.map((item, index) => {
                              const isEditing = editingCartItem === index;
                              
                              return (
                                <View key={item.id || index} style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                  borderRadius: 12,
                                  padding: 14,
                                  marginBottom: 10,
                                  borderWidth: 1,
                                  borderColor: 'rgba(255, 255, 255, 0.1)',
                                }}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <View style={{ flex: 1, marginRight: 12 }}>
                                      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
                                        {item.name || item.description || 'Material'}
                                      </Text>
                                      {!isEditing ? (
                                        <>
                                          <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 2 }}>
                                            {item.quantity || item.qty || 0} {item.unit || 'ea'} × {money(item.unitPrice || item.cost || 0)}
                                          </Text>
                                          {item.vendorId && (
                                            <Text style={{ color: Colors.sub, fontSize: 11 }}>
                                              {VENDORS.find(v => v.id === item.vendorId)?.name || item.vendorId}
                                            </Text>
                                          )}
                                          {item.sku && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                              <Ionicons name="barcode-outline" size={12} color="#22d3ee" />
                                              <Text style={{ color: '#22d3ee', fontSize: 11, marginLeft: 4 }}>
                                                {item.sku}
                                              </Text>
                                            </View>
                                          )}
                                        </>
                                      ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                                            <TouchableOpacity
                                              onPress={() => {
                                                const newQty = Math.max(1, (item.quantity || item.qty || 1) - 1);
                                                setMaterialsCart(prev => prev.map((it, i) => i === index ? { ...it, quantity: newQty, qty: newQty, total: (it.unitPrice || it.cost || 0) * newQty } : it));
                                              }}
                                              style={{ padding: 8 }}
                                            >
                                              <Ionicons name="remove" size={14} color={Colors.text} />
                                            </TouchableOpacity>
                                            <TextInput
                                              style={{ flex: 1, color: Colors.text, fontSize: 14, fontWeight: '600', textAlign: 'center', paddingVertical: 6 }}
                                              value={String(item.quantity || item.qty || 1)}
                                              onChangeText={(text) => {
                                                const num = parseInt(text) || 1;
                                                setMaterialsCart(prev => prev.map((it, i) => i === index ? { ...it, quantity: num, qty: num, total: (it.unitPrice || it.cost || 0) * num } : it));
                                              }}
                                              keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                                            />
                                            <TouchableOpacity
                                              onPress={() => {
                                                const newQty = (item.quantity || item.qty || 1) + 1;
                                                setMaterialsCart(prev => prev.map((it, i) => i === index ? { ...it, quantity: newQty, qty: newQty, total: (it.unitPrice || it.cost || 0) * newQty } : it));
                                              }}
                                              style={{ padding: 8 }}
                                            >
                                              <Ionicons name="add" size={14} color={Colors.text} />
                                            </TouchableOpacity>
                                          </View>
                                          <TouchableOpacity
                                            onPress={() => setEditingCartItem(null)}
                                            style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.primary, borderRadius: 8 }}
                                          >
                                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Done</Text>
                                          </TouchableOpacity>
                                        </View>
                                      )}
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                      <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>
                                        {money(item.total || 0)}
                                      </Text>
                                      <View style={{ flexDirection: 'row', gap: 6 }}>
                                        {!isEditing && (
                                          <TouchableOpacity
                                            onPress={() => setEditingCartItem(index)}
                                            style={{
                                              width: 28,
                                              height: 28,
                                              borderRadius: 14,
                                              backgroundColor: 'rgba(45, 255, 196, 0.15)',
                                              justifyContent: 'center',
                                              alignItems: 'center',
                                            }}
                                          >
                                            <Ionicons name="create-outline" size={14} color="#2DFFC4" />
                                          </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                          onPress={() => {
                                            setMaterialsCart(prev => prev.filter((_, i) => i !== index));
                                            if (editingCartItem === index) setEditingCartItem(null);
                                          }}
                                          style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: 14,
                                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                          }}
                                        >
                                          <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                  </View>
                                </View>
                              );
                            })}
                            
                            {materialsCart.length > 1 && (
                              <TouchableOpacity
                                onPress={() => {
                                  Alert.alert('Clear Cart?', 'This will remove all items from your cart.', [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Clear', style: 'destructive', onPress: () => setMaterialsCart([]) },
                                  ]);
                                }}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  paddingVertical: 10,
                                  marginTop: 8,
                                  marginBottom: 12,
                                }}
                              >
                                <Ionicons name="trash-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                                <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Clear Cart</Text>
                              </TouchableOpacity>
                            )}
                            
                            <View style={{
                              backgroundColor: 'rgba(45, 255, 196, 0.1)',
                              borderRadius: 12,
                              padding: 16,
                              borderWidth: 1,
                              borderColor: 'rgba(45, 255, 196, 0.3)',
                              marginTop: 8,
                            }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text style={{ color: Colors.sub, fontSize: 12 }}>Items</Text>
                                <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600' }}>
                                  {materialsCart.length}
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>
                                  Total Materials
                                </Text>
                                <Text style={{ color: '#2DFFC4', fontSize: 22, fontWeight: '700' }}>
                                  {money(materialsCart.reduce((sum, item) => sum + (item.total || 0), 0))}
                                </Text>
                              </View>
                            </View>
                          </>
                        )}
                      </>
                    )}
                  </GlassBorderCard>
                </View>
            </View>
            
            {/* SKU Search Modal */}
            <AttachSkuModal
              visible={skuModalVisible}
              defaultZip={bid.customerZip || ''}
              onClose={() => setSkuModalVisible(false)}
              onAttach={handleSkuAttach}
              onOpenSaved={() => {
                setSkuModalVisible(false);
                setTimeout(() => setSavedMaterialsVisible(true), 300); // Small delay for smooth transition
              }}
            />

            {/* Saved Materials Modal */}
            <Modal
              visible={savedMaterialsVisible}
              animationType="slide"
              onRequestClose={() => setSavedMaterialsVisible(false)}
            >
              <SavedMaterialsScreen
                onClose={() => setSavedMaterialsVisible(false)}
                onAddToBid={(item) => {
                  // Convert saved material format to SKU item format
                  const skuItem = {
                    sku: item.sku,
                    title: item.title,
                    price: item.price,
                    store: (item.store === 'hd' || item.store === 'lowes') ? item.store : 'hd',
                    zip: item.zip || '',
                    url: item.url || '',
                    image: item.image || null,
                    unit: item.unit || null,
                    quantity: item.quantity || 1,
                  };
                  handleSkuAttach(skuItem);
                  setSavedMaterialsVisible(false);
                }}
              />
            </Modal>

            {/* Custom Deposit Input Modal (Android fallback) */}
            <Modal
              visible={customDepositModal.visible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setCustomDepositModal({ visible: false, value: '' })}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <View style={{ backgroundColor: Colors.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: 'rgba(45, 255, 196, 0.3)' }}>
                  <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Custom Deposit</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginBottom: 20 }}>Enter deposit percentage (0-50)</Text>
                  
                  <TextInput
                    value={customDepositModal.value}
                    onChangeText={(text) => setCustomDepositModal({ ...customDepositModal, value: text })}
                    placeholder="Enter percentage"
                    placeholderTextColor={Colors.sub}
                    keyboardType="number-pad"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      color: Colors.text,
                      fontSize: 16,
                      marginBottom: 20,
                    }}
                    autoFocus={true}
                  />
                  
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => setCustomDepositModal({ visible: false, value: '' })}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const numPct = parseInt(customDepositModal.value);
                        if (customDepositModal.value && numPct >= 0 && numPct <= 50) {
                          // Get current state from bid
                          const currentMilestones = bid.paymentMilestones || [];
                          const currentWeeklyPayments = bid.weeklyPayments || [];
                          const currentGrandTotal = calc?.grandTotal || calc?.total || 0;
                          
                          // Get current final milestone
                          const finalMilestone = currentMilestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                          const currentFinalPct = finalMilestone?.percentage || 0;
                          
                          // Validate and adjust percentages to prevent exceeding 100%
                          const totalPct = numPct + currentFinalPct;
                          let adjustedFinalPct = currentFinalPct;
                          let remainingPct = 100 - numPct - currentFinalPct;
                          let warning = null;
                          
                          if (totalPct > 100) {
                            adjustedFinalPct = Math.max(0, 100 - numPct);
                            remainingPct = 0;
                            warning = `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`;
                          } else if (remainingPct < 0) {
                            adjustedFinalPct = Math.max(0, 100 - numPct);
                            remainingPct = 0;
                            warning = `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`;
                          }
                          
                          // Show warning if adjustment was needed
                          if (warning) {
                            Alert.alert('⚠️ Payment Adjustment', warning);
                          }
                          
                          // Calculate amounts from grandTotal
                          const depositAmount = (currentGrandTotal * numPct) / 100;
                          const finalAmount = (currentGrandTotal * adjustedFinalPct) / 100;
                          
                          // Update deposit milestone
                          const depositMilestone = currentMilestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                          let updatedMilestones = currentMilestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                          updatedMilestones.unshift({
                            id: depositMilestone?.id || `milestone-deposit-${Date.now()}`,
                            name: 'Deposit',
                            paymentAmount: depositAmount,
                            percentage: numPct,
                            type: 'deposit'
                          });
                          
                          // Update final milestone if it was adjusted
                          if (finalMilestone) {
                            updatedMilestones = updatedMilestones.filter(m => !(m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'))));
                            updatedMilestones.push({
                              id: finalMilestone.id,
                              name: 'Final Completion',
                              paymentAmount: finalAmount,
                              percentage: adjustedFinalPct,
                              type: 'final'
                            });
                          }
                          
                          // ALWAYS recalculate weekly payments based on new remaining percentage
                          const currentWeeks = currentWeeklyPayments.length > 0 ? currentWeeklyPayments.length : 5;
                          let newWeekly = [];
                          if (remainingPct > 0 && currentWeeks > 0) {
                            const weeklyPct = remainingPct / currentWeeks;
                            const weeklyAmount = (currentGrandTotal * weeklyPct) / 100;
                            newWeekly = Array.from({ length: currentWeeks }, (_, i) => ({
                              id: `weekly-hybrid-${Date.now()}-${i}`,
                              weekNumber: i + 1,
                              description: `Week ${i + 1} Payment`,
                              amount: weeklyAmount,
                              percentage: weeklyPct,
                            }));
                          }
                          
                          // Update both milestones and weekly payments in a single state update
                          setBid(prev => {
                            // Normalize hybrid payments together to ensure combined total equals exactly grandTotal
                            const normalized = normalizeHybridPaymentsToExactTotal(updatedMilestones, newWeekly, currentGrandTotal);
                            
                            const updated = { ...prev, paymentMilestones: normalized.milestones, weeklyPayments: normalized.weeklyPayments };
                            // Auto-save payment schedule changes immediately
                            AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                            return updated;
                          });
                          setCustomDepositModal({ visible: false, value: '' });
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } else {
                          Alert.alert('Invalid', 'Please enter a percentage between 0 and 50');
                        }
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: Colors.primary,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Set</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Custom Final Payment Input Modal (Android fallback) */}
            <Modal
              visible={customFinalModal.visible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setCustomFinalModal({ visible: false, value: '' })}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <View style={{ backgroundColor: Colors.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: 'rgba(45, 255, 196, 0.3)' }}>
                  <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Custom Final Payment</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginBottom: 20 }}>Enter final payment percentage (0-50)</Text>
                  
                  <TextInput
                    value={customFinalModal.value}
                    onChangeText={(text) => setCustomFinalModal({ ...customFinalModal, value: text })}
                    placeholder="Enter percentage"
                    placeholderTextColor={Colors.sub}
                    keyboardType="number-pad"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      color: Colors.text,
                      fontSize: 16,
                      marginBottom: 20,
                    }}
                    autoFocus={true}
                  />
                  
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => setCustomFinalModal({ visible: false, value: '' })}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const numPct = parseInt(customFinalModal.value);
                        if (customFinalModal.value && numPct >= 0 && numPct <= 50) {
                          // Get current state from bid
                          const currentMilestones = bid.paymentMilestones || [];
                          const currentWeeklyPayments = bid.weeklyPayments || [];
                          const currentGrandTotal = calc?.grandTotal || calc?.total || 0;
                          
                          // Get current deposit milestone
                          const depositMilestone = currentMilestones.find(m => m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit')));
                          const currentDepositPct = depositMilestone?.percentage || 0;
                          
                          // Validate and adjust percentages to prevent exceeding 100%
                          const totalPct = currentDepositPct + numPct;
                          let adjustedFinalPct = numPct;
                          let adjustedDepositPct = currentDepositPct;
                          let remainingPct = 100 - currentDepositPct - numPct;
                          let warning = null;
                          
                          if (totalPct > 100) {
                            adjustedFinalPct = Math.max(0, 100 - currentDepositPct);
                            remainingPct = 0;
                            warning = `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`;
                          } else if (remainingPct < 0) {
                            adjustedFinalPct = Math.max(0, 100 - currentDepositPct);
                            remainingPct = 0;
                            warning = `Total would exceed 100%. Final payment adjusted to ${adjustedFinalPct}%`;
                          }
                          
                          // Show warning if adjustment was needed
                          if (warning) {
                            Alert.alert('⚠️ Payment Adjustment', warning);
                          }
                          
                          // Calculate amounts from grandTotal
                          const depositAmount = (currentGrandTotal * adjustedDepositPct) / 100;
                          const finalAmount = (currentGrandTotal * adjustedFinalPct) / 100;
                          
                          // Update deposit milestone if it was adjusted
                          let updatedMilestones = currentMilestones.filter(m => !(m.type === 'deposit' || (m.name && m.name.toLowerCase().includes('deposit'))));
                          if (depositMilestone) {
                            updatedMilestones.unshift({
                              id: depositMilestone.id,
                              name: 'Deposit',
                              paymentAmount: depositAmount,
                              percentage: adjustedDepositPct,
                              type: 'deposit'
                            });
                          }
                          
                          // Update final milestone
                          const finalMilestone = currentMilestones.find(m => m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion')));
                          updatedMilestones = updatedMilestones.filter(m => !(m.type === 'final' || (m.name && m.name.toLowerCase().includes('final')) || (m.name && m.name.toLowerCase().includes('completion'))));
                          updatedMilestones.push({
                            id: finalMilestone?.id || `milestone-final-${Date.now()}`,
                            name: 'Final Completion',
                            paymentAmount: finalAmount,
                            percentage: adjustedFinalPct,
                            type: 'final'
                          });
                          
                          // ALWAYS recalculate weekly payments based on new remaining percentage
                          const currentWeeks = currentWeeklyPayments.length > 0 ? currentWeeklyPayments.length : 5;
                          let newWeekly = [];
                          if (remainingPct > 0 && currentWeeks > 0) {
                            const weeklyPct = remainingPct / currentWeeks;
                            const weeklyAmount = (currentGrandTotal * weeklyPct) / 100;
                            newWeekly = Array.from({ length: currentWeeks }, (_, i) => ({
                              id: `weekly-hybrid-${Date.now()}-${i}`,
                              weekNumber: i + 1,
                              description: `Week ${i + 1} Payment`,
                              amount: weeklyAmount,
                              percentage: weeklyPct,
                            }));
                          }
                          
                          // Update both milestones and weekly payments in a single state update
                          setBid(prev => {
                            const updated = { ...prev, paymentMilestones: updatedMilestones, weeklyPayments: newWeekly };
                            // Auto-save payment schedule changes immediately
                            AsyncStorage.setItem(BID_STORAGE_KEY, JSON.stringify(updated)).catch(err => console.error('Error auto-saving:', err));
                            return updated;
                          });
                          setCustomFinalModal({ visible: false, value: '' });
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } else {
                          Alert.alert('Invalid', 'Please enter a percentage between 0 and 50');
                        }
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: Colors.primary,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Set</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        );
      }
      
      case 4: {
        const laborItems = bid.laborLineItems || [];
        const totalLabor = laborItems.reduce((sum, item) => sum + (item.total || 0), 0);
        
        return (
          <>
            <View style={[s.wideContainer, { marginTop: 16 }]}>
              {/* Header */}
              <GlassBorderCard radius={24} innerRadius={22} pad={20}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name="people-outline" size={20} color="#2DFFC4" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Labor & Subcontractors</Text>
                    <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>In-house and subcontractor labor</Text>
                  </View>
                </View>
                
                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: laborModal.visible ? Colors.primary : 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: laborModal.visible ? Colors.primary : 'rgba(255, 255, 255, 0.15)',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      minWidth: 0,
                    }}
                    onPress={() => setLaborModal({ visible: true, item: null })}
                  >
                    <Ionicons name="add" size={18} color={laborModal.visible ? '#fff' : Colors.text} style={{ marginRight: 6 }} />
                    <Text style={{ color: laborModal.visible ? '#fff' : Colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>Add Labor Item</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: subcontractorModalVisible ? Colors.primary : 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: subcontractorModalVisible ? Colors.primary : 'rgba(255, 255, 255, 0.1)',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      minWidth: 0,
                    }}
                    onPress={() => setSubcontractorModalVisible(true)}
                  >
                    <Ionicons name="search" size={18} color={subcontractorModalVisible ? '#fff' : Colors.primary} style={{ marginRight: 6 }} />
                    <Text style={{ color: subcontractorModalVisible ? '#fff' : Colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>Find Subcontractor</Text>
                  </TouchableOpacity>
                </View>
              </GlassBorderCard>
              
              {/* Labor Cart Summary */}
              <View style={{ marginTop: 16 }}>
                <GlassBorderCard radius={24} innerRadius={22} pad={20}>
                  <TouchableOpacity
                    onPress={() => setIsLaborCartExpanded(!isLaborCartExpanded)}
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isLaborCartExpanded ? 16 : 0 }}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Ionicons name="people-outline" size={16} color="#2DFFC4" />
                    </View>
                    <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
                      Labor Items
                    </Text>
                    {laborItems.length > 0 && (
                      <View style={{ backgroundColor: 'rgba(45, 255, 196, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 }}>
                        <Text style={{ color: '#2DFFC4', fontSize: 13, fontWeight: '700' }}>
                          {laborItems.length}
                        </Text>
                      </View>
                    )}
                    <Ionicons
                      name={isLaborCartExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={Colors.sub}
                    />
                  </TouchableOpacity>
                  
                  {isLaborCartExpanded && (
                    <>
                      {laborItems.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                            <Ionicons name="people-outline" size={28} color={Colors.sub} />
                          </View>
                          <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
                            No labor items yet
                          </Text>
                          <Text style={{ color: Colors.sub, fontSize: 13, textAlign: 'center' }}>
                            Add in-house labor or search for subcontractors
                          </Text>
                        </View>
                      ) : (
                        <>
                          {laborItems.map((item, index) => (
                            <View key={item.id || index} style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: 12,
                              padding: 14,
                              marginBottom: 10,
                              borderWidth: 1,
                              borderColor: 'rgba(255, 255, 255, 0.1)',
                            }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600' }}>
                                      {item.description || item.name || 'Labor'}
                                    </Text>
                                    {item.laborType === 'subcontractor' && (
                                      <View style={{
                                        marginLeft: 8,
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 6,
                                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                        borderWidth: 1,
                                        borderColor: '#f59e0b',
                                      }}>
                                        <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '600' }}>
                                          SUB
                                        </Text>
                                      </View>
                                    )}
                                    {item.laborType === 'inhouse' && (
                                      <View style={{
                                        marginLeft: 8,
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 6,
                                        backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                        borderWidth: 1,
                                        borderColor: '#22c55e',
                                      }}>
                                        <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '600' }}>
                                          IN-HOUSE
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 2 }}>
                                    {item.mode === 'sqft' ? (
                                      `${bid.sqft || 0} sqft × ${money(item.rate || 0)}/sqft`
                                    ) : (
                                      `${item.hours || 0} hrs × ${money(item.rate || 0)}/hr`
                                    )}
                                  </Text>
                                  {item.metadata && (
                                    <View style={{ marginTop: 4 }}>
                                      {item.metadata.rating && (
                                        <Text style={{ color: Colors.sub, fontSize: 11 }}>
                                          ⭐ {item.metadata.rating} ({item.metadata.reviews || 0} reviews)
                                        </Text>
                                      )}
                                      {item.metadata.location && (
                                        <Text style={{ color: Colors.sub, fontSize: 11 }}>
                                          📍 {item.metadata.location}
                                        </Text>
                                      )}
                                    </View>
                                  )}
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={{ color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>
                                    {money(item.total || 0)}
                                  </Text>
                                  <TouchableOpacity
                                    onPress={() => {
                                      Alert.alert(
                                        'Delete Labor Item?',
                                        `Remove "${item.description || item.name || 'Labor'}"?`,
                                        [
                                          { text: 'Cancel', style: 'cancel' },
                                          {
                                            text: 'Delete',
                                            style: 'destructive',
                                            onPress: () => {
                                              const updated = laborItems.filter(l => l.id !== item.id);
                                              updateBid('laborLineItems', updated);
                                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            }
                                          }
                                        ]
                                      );
                                    }}
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 14,
                                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          ))}
                          
                          {laborItems.length > 1 && (
                            <TouchableOpacity
                              onPress={() => {
                                Alert.alert('Clear All?', 'This will remove all labor items.', [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Clear', style: 'destructive', onPress: () => updateBid('laborLineItems', []) },
                                ]);
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingVertical: 10,
                                marginTop: 8,
                                marginBottom: 12,
                              }}
                            >
                              <Ionicons name="trash-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                              <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Clear All</Text>
                            </TouchableOpacity>
                          )}
                          
                          <View style={{
                            backgroundColor: 'rgba(45, 255, 196, 0.1)',
                            borderRadius: 12,
                            padding: 16,
                            borderWidth: 1,
                            borderColor: 'rgba(45, 255, 196, 0.3)',
                            marginTop: 8,
                          }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <Text style={{ color: Colors.sub, fontSize: 12 }}>Items</Text>
                              <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '600' }}>
                                {laborItems.length}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700' }}>
                                Total Labor
                              </Text>
                              <Text style={{ color: '#2DFFC4', fontSize: 22, fontWeight: '700' }}>
                                {money(totalLabor)}
                              </Text>
                            </View>
                          </View>
                        </>
                      )}
                    </>
                  )}
                </GlassBorderCard>
              </View>
            </View>
            
            {/* Subcontractor Search Modal */}
            <SubcontractorSearchModal
              visible={subcontractorModalVisible}
              onClose={() => setSubcontractorModalVisible(false)}
              onSelect={handleSubcontractorSelect}
              defaultZip={bid.customerZip || ''}
            />
          </>
        );
      }
      
      case 5: {
        // Load contractor type from profile or bid
        const contractorType = bid.contractorType || null;
        
        // Contractor type definitions
        const contractorTypes = {
          1: {
            name: 'Solo + Helper (No Subs)',
            description: 'I do everything myself',
            overheadRange: { min: 5, max: 8 },
            safeMarkupRange: { min: 15, max: 20 },
            defaultMarkup: 18,
          },
          2: {
            name: 'Small Crew + Subs',
            description: '1-3 guys + subcontractors',
            overheadRange: { min: 8, max: 12 },
            safeMarkupRange: { min: 20, max: 25 },
            defaultMarkup: 22,
          },
          3: {
            name: 'Subcontractor-Only GC',
            description: 'I manage, no direct labor',
            overheadRange: { min: 6, max: 10 },
            safeMarkupRange: { min: 15, max: 20 },
            defaultMarkup: 18,
          },
          4: {
            name: 'Large Crew + Subs',
            description: '5+ guys + subcontractors',
            overheadRange: { min: 12, max: 18 },
            safeMarkupRange: { min: 25, max: 30 },
            defaultMarkup: 27,
          },
        };
        
        // Ensure contractorType is a number for proper lookup
        const normalizedContractorType = contractorType ? parseInt(contractorType) : null;
        const contractorInfo = normalizedContractorType ? contractorTypes[normalizedContractorType] : null;
        
        // Calculate total overhead
        const totalOverhead = (bid.insuranceOverhead || 0) + 
                              (bid.equipment || 0) + 
                              (bid.facilities || 0) + 
                              (bid.otherOverhead || 0);
        
        // Calculate overhead as percentage of job total
        const jobTotal = calc?.grandTotal || calc?.total || 0;
        const overheadPct = jobTotal > 0 ? (totalOverhead / jobTotal) * 100 : 0;
        
        // Calculate recommended markup based on contractor type and job characteristics
        const materialsTotal = calc?.materials || 0;
        const laborTotal = calc?.labor || 0;
        const materialsRatio = jobTotal > 0 ? (materialsTotal / jobTotal) : 0.5;
        const laborRatio = jobTotal > 0 ? (laborTotal / jobTotal) : 0.5;
        
        // Recommended markup calculation based on contractor type
        // ALWAYS use contractor type default if set, otherwise calculate from job characteristics
        let recommendedMarkup;
        
        if (contractorInfo && normalizedContractorType) {
          // Use contractor type's default markup (this is the primary recommendation)
          recommendedMarkup = contractorInfo.defaultMarkup;
        } else {
          // Fallback: calculate based on job size and material/labor mix
          recommendedMarkup = 20;
          if (jobTotal > 100000) {
            recommendedMarkup = 22;
          } else if (jobTotal < 20000) {
            recommendedMarkup = 25;
          }
          if (laborRatio > 0.6) {
            recommendedMarkup += 2;
          }
          if (materialsRatio > 0.6) {
            recommendedMarkup -= 1;
          }
        }
        recommendedMarkup = Math.round(recommendedMarkup);
        
        // Calculate net profit (markup - overhead as % of subtotal)
        const currentMarkup = bid.markupPct || 0;
        const profit = calc?.profit || 0;
        const subtotal = calc?.subtotal || 0;
        const netProfitPct = subtotal > 0 ? ((profit - totalOverhead) / subtotal) * 100 : 0;
        
        // AI badge always shows - determine message and button text
        let showApplyButton = true; // Always show the AI badge
        let applyButtonText = '';
        let contextualMessage = null;
        const currentMarkupNum = Number(currentMarkup);
        const recommendedMarkupNum = Number(recommendedMarkup);
        const defaultMarkup = 20; // Global default markup
        
        if (contractorInfo && normalizedContractorType) {
          const { safeMarkupRange } = contractorInfo;
          const minMarkup = Number(safeMarkupRange.min);
          const maxMarkup = Number(safeMarkupRange.max);
          const rangeSize = maxMarkup - minMarkup;
          
          // Check if current markup matches default (20%) or recommended (within 1% tolerance)
          const matchesDefault = Math.abs(currentMarkupNum - defaultMarkup) <= 1;
          const matchesRecommended = Math.abs(currentMarkupNum - recommendedMarkupNum) <= 1;
          const atMin = Math.abs(currentMarkupNum - minMarkup) <= 1;
          const atMax = Math.abs(currentMarkupNum - maxMarkup) <= 1;
          
          // If at minimum of range (which may also be the default), show range option
          if (atMin && rangeSize > 0) {
            // At minimum of range - show range option (e.g., "Apply 0-5%" for 20-25% range)
            applyButtonText = `Apply 0-${rangeSize}%`;
            contextualMessage = {
              type: 'inRange',
              text: 'At minimum of range — can increase up to maximum',
              color: '#22c55e',
            };
          } else if (matchesRecommended && !atMin) {
            // At recommended (but not at min) - show "Apply 0%"
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'At recommended markup — optimal',
              color: '#22c55e',
            };
          } else if (atMax) {
            // At maximum of range - show "Apply 0%"
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'At maximum of range — optimal',
              color: '#22c55e',
            };
          } else if (currentMarkupNum < minMarkup) {
            // Below minimum - show range needed to get into the safe range
            const diffToMin = Math.round(minMarkup - currentMarkupNum);
            const diffToMax = Math.round(maxMarkup - currentMarkupNum);
            applyButtonText = `Apply ${diffToMin}-${diffToMax}%`;
            contextualMessage = {
              type: 'low',
              text: 'Below typical range — risk of underpricing',
              color: '#ef4444',
            };
          } else if (currentMarkupNum > maxMarkup + 5) {
            // Far above range - show optional lower suggestion
            applyButtonText = `Lower to ${recommendedMarkup}% (optional)`;
            contextualMessage = {
              type: 'high',
              text: 'Above typical range — higher profit, may reduce competitiveness',
              color: '#fbbf24',
            };
          } else if (currentMarkupNum > maxMarkup) {
            // Slightly above range
            applyButtonText = `Lower to ${recommendedMarkup}% (optional)`;
            contextualMessage = {
              type: 'above',
              text: 'Above typical range — higher profitability',
              color: '#38d39f',
            };
          } else if (currentMarkupNum < recommendedMarkupNum) {
            // Within range but below recommended
            const diffToRecommended = Math.round(recommendedMarkupNum - currentMarkupNum);
            applyButtonText = `Apply ${diffToRecommended}%`;
            contextualMessage = {
              type: 'inRange',
              text: 'Within typical range — consider recommended',
              color: '#38d39f',
            };
          } else {
            // Within range, above recommended but not far above
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'Within typical range — good',
              color: '#22c55e',
            };
          }
        } else {
          // Generic logic if no contractor type
          const matchesDefault = Math.abs(currentMarkupNum - defaultMarkup) <= 1;
          const matchesRecommended = Math.abs(currentMarkupNum - recommendedMarkupNum) <= 1;
          
          if (matchesDefault || matchesRecommended) {
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'At recommended markup — optimal',
              color: '#22c55e',
            };
          } else if (currentMarkup < 15) {
            applyButtonText = `Apply ${recommendedMarkup}%`;
            contextualMessage = {
              type: 'low',
              text: 'Below typical range — risk of underpricing',
              color: '#ef4444',
            };
          } else if (currentMarkup > 30) {
            applyButtonText = `Lower to ${recommendedMarkup}% (optional)`;
            contextualMessage = {
              type: 'high',
              text: 'Above typical range — higher profit, may reduce competitiveness',
              color: '#fbbf24',
            };
          } else if (currentMarkupNum < recommendedMarkupNum) {
            applyButtonText = `Apply ${recommendedMarkup}%`;
            contextualMessage = {
              type: 'inRange',
              text: 'Within typical range — consider recommended',
              color: '#22c55e',
            };
          } else {
            applyButtonText = 'Apply 0%';
            contextualMessage = {
              type: 'inRange',
              text: 'Within typical range — good',
              color: '#22c55e',
            };
          }
        }
        
        // Health badge based on NET PROFIT (markup - overhead), not just markup
        // Always show feedback, even if no subtotal yet
        let markupStatus = 'good';
        let markupStatusText = 'Right percentage – within typical range';
        let markupStatusColor = '#38d39f';
        
        if (subtotal > 0) {
          // Calculate based on net profit when we have subtotal
          if (netProfitPct < 5) {
            markupStatus = 'risk';
            markupStatusText = 'Too low – net profit too low, increase markup';
            markupStatusColor = '#ef4444';
          } else if (netProfitPct < 8) {
            markupStatus = 'warn';
            markupStatusText = 'Too low – thin margins, consider increasing markup';
            markupStatusColor = '#fbbf24';
          } else if (netProfitPct >= 15) {
            markupStatus = 'strong';
            markupStatusText = 'Right percentage – strong profitability';
            markupStatusColor = '#38d39f'; // Green for "strong"
          } else {
            markupStatus = 'good';
            markupStatusText = 'Right percentage – healthy and profitable';
            markupStatusColor = '#38d39f';
          }
        } else if (contractorInfo && normalizedContractorType) {
          // If no subtotal yet, validate based on markup vs contractor type range
          const { safeMarkupRange } = contractorInfo;
          const minMarkup = Number(safeMarkupRange.min);
          const maxMarkup = Number(safeMarkupRange.max);
          const currentMarkupNum = Number(currentMarkup);
          
          if (currentMarkupNum === 0) {
            markupStatus = 'warn';
            markupStatusText = 'Set your markup percentage';
            markupStatusColor = '#fbbf24';
          } else if (currentMarkupNum < minMarkup) {
            markupStatus = 'risk';
            markupStatusText = 'Too low – below typical range for your business type';
            markupStatusColor = '#ef4444';
          } else if (currentMarkupNum > maxMarkup) {
            markupStatus = 'warn';
            markupStatusText = 'Too high – above typical range, may reduce competitiveness';
            markupStatusColor = '#fbbf24';
          } else {
            markupStatus = 'good';
            markupStatusText = 'Right percentage – within typical range';
            markupStatusColor = '#38d39f';
          }
        } else {
          // Generic validation if no contractor type
          if (currentMarkup === 0) {
            markupStatus = 'warn';
            markupStatusText = 'Set your markup percentage';
            markupStatusColor = '#fbbf24';
          } else if (currentMarkup < 15) {
            markupStatus = 'risk';
            markupStatusText = 'Too low – below typical range';
            markupStatusColor = '#ef4444';
          } else if (currentMarkup > 25) {
            markupStatus = 'warn';
            markupStatusText = 'Too high – above typical range, may reduce competitiveness';
            markupStatusColor = '#fbbf24';
          } else {
            markupStatus = 'good';
            markupStatusText = 'Right percentage – within typical range';
            markupStatusColor = '#38d39f';
          }
        }
        
        return (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={[s.wideContainer, { marginTop: 16 }]}>
              <GlassBorderCard radius={24} innerRadius={22} pad={20}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 255, 196, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name="calculator-outline" size={20} color="#2DFFC4" />
                  </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontSize: 20, fontWeight: '800' }}>Overhead & Markup</Text>
                  <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Break down overhead, tune markup</Text>
                </View>
              </View>
              
              {/* Contractor Type Selector */}
              <View style={s.inputGroup}>
                <Text style={s.label}>Business Type</Text>
                <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 8 }}>
                  Select your business model for personalized recommendations
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(contractorTypes).map(([type, info]) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => {
                        updateBid('contractorType', parseInt(type));
                        // Don't auto-apply markup - let user keep their current value and see recommendations
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        flex: 1,
                        minWidth: '47%',
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: normalizedContractorType === parseInt(type) 
                          ? '#38d39f' 
                          : 'rgba(255, 255, 255, 0.15)',
                        backgroundColor: normalizedContractorType === parseInt(type)
                          ? 'rgba(56, 211, 159, 0.1)'
                          : 'rgba(255, 255, 255, 0.03)',
                      }}
                    >
                      <Text style={{ 
                        color: normalizedContractorType === parseInt(type) ? '#38d39f' : Colors.text, 
                        fontSize: 13, 
                        fontWeight: contractorType === parseInt(type) ? '700' : '600',
                        marginBottom: 4,
                      }}>
                        {info.name}
                      </Text>
                      <Text style={{ 
                        color: Colors.sub, 
                        fontSize: 11,
                      }}>
                        {info.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {/* Show recommendations if contractor type is set */}
                {contractorInfo && (
                  <View style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: 'rgba(56, 211, 159, 0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(56, 211, 159, 0.2)',
                  }}>
                    <Text style={{ color: '#38d39f', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
                      Suggested for {contractorInfo.name}:
                    </Text>
                    <Text style={{ color: Colors.sub, fontSize: 11 }}>
                      Markup: {contractorInfo.safeMarkupRange.min}–{contractorInfo.safeMarkupRange.max}% • 
                      Overhead: {contractorInfo.overheadRange.min}–{contractorInfo.overheadRange.max}%
                    </Text>
                    <Text style={{ color: Colors.sub, fontSize: 10, marginTop: 4, fontStyle: 'italic' }}>
                      Typical range — not a limit
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Insurance Overhead</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="0"
                  placeholderTextColor={Colors.sub}
                  value={bid.insuranceOverhead && bid.insuranceOverhead !== 0 ? bid.insuranceOverhead.toString() : ''}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('insuranceOverhead', 0);
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('insuranceOverhead', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Equipment</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="0"
                  placeholderTextColor={Colors.sub}
                  value={bid.equipment && bid.equipment !== 0 ? bid.equipment.toString() : ''}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('equipment', 0);
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('equipment', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Facilities</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="0"
                  placeholderTextColor={Colors.sub}
                  value={bid.facilities && bid.facilities !== 0 ? bid.facilities.toString() : ''}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('facilities', 0);
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('facilities', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Other Overhead</Text>
                <TextInput
                  style={[s.input, { color: Colors.text }]}
                  placeholder="0"
                  placeholderTextColor={Colors.sub}
                  value={bid.otherOverhead && bid.otherOverhead !== 0 ? bid.otherOverhead.toString() : ''}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('otherOverhead', 0);
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('otherOverhead', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
              </View>
              
              {/* Total Overhead Summary */}
              {totalOverhead > 0 && (
                <View style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                }}>
                  <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
                    Total Overhead: <Text style={{ color: '#22d3ee' }}>{money(totalOverhead)}</Text>
                  </Text>
                  <Text style={{ color: Colors.sub, fontSize: 12 }}>
                    ≈ {overheadPct.toFixed(1)}% of job total
                  </Text>
                </View>
              )}
              
              {/* Total Overhead and Markup Summary */}
              {(totalOverhead > 0 || (calc?.profit && calc.profit > 0)) && (
                <View style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                }}>
                  <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
                    Total Overhead & Markup: <Text style={{ color: '#22d3ee' }}>{money(totalOverhead + (calc?.profit || 0))}</Text>
                  </Text>
                  <Text style={{ color: Colors.sub, fontSize: 12 }}>
                    Overhead: {money(totalOverhead)} + Markup: {money(calc?.profit || 0)}
                  </Text>
                  {jobTotal > 0 && (
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2 }}>
                      ≈ {((totalOverhead + (calc?.profit || 0)) / jobTotal * 100).toFixed(1)}% of job total
                    </Text>
                  )}
                </View>
              )}
              
              {/* Total Bid Summary */}
              {calc && (
                <View style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                }}>
                  <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 }}>
                    Total Bid: <Text style={{ color: '#22d3ee' }}>{money(calc?.grandTotal || calc?.total || 0)}</Text>
                  </Text>
                  <Text style={{ color: Colors.sub, fontSize: 12 }}>
                    Final project total including all costs, overhead, and markup
                  </Text>
                </View>
              )}
              
              <View style={s.inputGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={s.label}>Markup Percentage</Text>
                  <TouchableOpacity
                    onPress={() => {
                      // Only update if not already at recommended (not "Apply 0%")
                      if (applyButtonText !== 'Apply 0%') {
                        // If it's a range (e.g., "Apply 0-5%"), apply the recommended markup
                        updateBid('markupPct', recommendedMarkup);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    style={{
                      backgroundColor: contextualMessage?.type === 'low' 
                        ? 'rgba(239, 68, 68, 0.15)' 
                        : contextualMessage?.type === 'inRange' && applyButtonText === 'Apply 0%'
                        ? 'rgba(56, 211, 159, 0.15)'
                        : 'rgba(251, 191, 36, 0.15)',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons 
                      name="sparkles" 
                      size={14} 
                      color={contextualMessage?.type === 'low' 
                        ? '#ef4444' 
                        : contextualMessage?.type === 'inRange' && applyButtonText === 'Apply 0%'
                        ? '#38d39f'
                        : '#fbbf24'} 
                    />
                    <Text style={{ 
                      color: contextualMessage?.type === 'low' 
                        ? '#ef4444' 
                        : contextualMessage?.type === 'inRange' && applyButtonText === 'Apply 0%'
                        ? '#38d39f'
                        : '#fbbf24', 
                      fontSize: 12, 
                      fontWeight: '600' 
                    }}>
                      {applyButtonText}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  ref={markupInputRef}
                  style={[s.input, { color: Colors.text }]}
                  placeholder="20"
                  placeholderTextColor={Colors.sub}
                  value={markupPctText}
                  onFocus={() => {
                    isMarkupFocused.current = true;
                  }}
                  onChangeText={(text) => {
                    // Only update local state while typing - no re-renders of parent
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    setMarkupPctText(cleaned);
                  }}
                  onBlur={() => {
                    isMarkupFocused.current = false;
                    // Only update bid state when done typing
                    const cleaned = markupPctText.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('markupPct', 0);
                      setMarkupPctText('0');
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('markupPct', num);
                      }
                    }
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                    // Also apply the value on submit
                    isMarkupFocused.current = false;
                    const cleaned = markupPctText.replace(/[^0-9.]/g, '');
                    if (cleaned === '' || cleaned === '.') {
                      updateBid('markupPct', 0);
                      setMarkupPctText('0');
                    } else {
                      const num = parseFloat(cleaned);
                      if (!isNaN(num)) {
                        updateBid('markupPct', num);
                      }
                    }
                  }}
                  blurOnSubmit={true}
                />
